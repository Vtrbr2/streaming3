// ================================================================
//                       🚀 SERVIDOR MAGFLIX
// ================================================================
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();

// ================================================================
//                        CORS liberado
// ================================================================
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());

const PORT = process.env.PORT || 3000;
const URL_BASE = 'https://www.pobreflixtv.gift';

// ================================================================
// 🔍 ENDPOINT: /api/buscar (Busca automática - Live Search)
// ================================================================
app.get('/api/buscar', async (req, res) => {
  try {
    const { q, type = 'todos', genre = '', year = '', page = 1 } = req.query;

    // Validação: precisa ter pelo menos 2 caracteres
    if (!q || q.trim().length < 2) {
      return res.json({
        success: true,
        query: q || '',
        total: 0,
        results: [],
        message: 'Digite pelo menos 2 caracteres para buscar'
      });
    }

    console.log(`🔍 Buscando: "${q}" (tipo: ${type}, página: ${page})`);

    // ===== CONSTRÓI A URL =====
    const searchUrl = `${URL_BASE}/index.php?app=videobox&module=video&controller=index&do=buscarContent&q=${encodeURIComponent(q)}&type=${type}&genre=${genre}&year=${year}&page=${page}`;

    // ===== FAZ A REQUISIÇÃO =====
    const { data } = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': `${URL_BASE}/buscar/?q=${encodeURIComponent(q)}`,
        ...(COOKIE_STRING && { Cookie: COOKIE_STRING })
      },
      timeout: 15000
    });

    // ===== EXTRAI O HTML DA RESPOSTA =====
    let htmlContent = data.html || data;

    // Se for string, tenta parsear
    if (typeof htmlContent === 'string' && htmlContent.startsWith('{')) {
      try {
        const parsed = JSON.parse(htmlContent);
        htmlContent = parsed.html || htmlContent;
      } catch (e) {
        // Mantém como está
      }
    }

    // ===== PARSEIA O HTML COM CHEERIO =====
    const $ = cheerio.load(htmlContent);

    const results = [];

    // ===== EXTRAI OS RESULTADOS =====
    $('.block').each((i, el) => {
      const item = $(el);
      
      // Link do filme/série
      const link = item.attr('href') || '';
      
      // Título
      const titulo = item.find('.info h3').text().trim() || '';
      
      // Ano
      const ano = item.find('.info p').text().trim() || '';
      
      // Imagem
      const imagem = item.find('img').attr('src') || '';
      
      // Qualidade e áudio (HD, DUB, LEG, DUAL)
      const topTags = item.find('.top div');
      const qualidade = topTags.eq(0).text().trim() || 'HD';
      const audio = topTags.eq(1).text().trim() || '';
      
      // Determina o tipo (filme ou série) pelo link
      let tipo = 'filme';
      if (link.includes('/series/')) {
        tipo = 'serie';
      } else if (link.includes('/filmes/')) {
        tipo = 'filme';
      }

      // Extrai o slug do link
      const slugMatch = link.match(/\/([^/]+)-(\d+)\/$/);
      const slug = slugMatch ? slugMatch[1] : '';
      const id = slugMatch ? slugMatch[2] : '';

      results.push({
        id: id,
        slug: slug,
        titulo: titulo,
        ano: ano,
        imagem: imagem,
        qualidade: qualidade,
        audio: audio,
        tipo: tipo,
        link: link,
        link_assistir: link
      });
    });

    // ===== EXTRAI INFORMAÇÕES DE PAGINAÇÃO =====
    let totalPaginas = 1;
    let paginaAtual = parseInt(page) || 1;

    // Tenta extrair total de páginas da paginação
    $('.ipsPagination_page a').each((i, el) => {
      const pageNum = parseInt($(el).text().trim());
      if (!isNaN(pageNum) && pageNum > totalPaginas) {
        totalPaginas = pageNum;
      }
    });

    // Verifica se tem próxima página
    const hasNext = $('.ipsPagination_next:not(.ipsPagination_inactive)').length > 0;

    // ===== MONTA A RESPOSTA =====
    const response = {
      success: true,
      query: q,
      type: type,
      genre: genre,
      year: year,
      total: results.length,
      total_paginas: totalPaginas,
      pagina_atual: paginaAtual,
      has_next: hasNext,
      results: results
    };

    console.log(`✅ Busca "${q}" retornou ${results.length} resultados`);
    res.json(response);

  } catch (error) {
    console.error('❌ Erro na busca:', error.message);
    
    // Se for erro de timeout ou conexão, retorna mensagem amigável
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return res.status(504).json({
        success: false,
        error: 'Tempo limite excedido. Tente novamente.',
        query: req.query.q || ''
      });
    }

    res.status(500).json({
      success: false,
      error: 'Erro ao realizar busca',
      detalhe: error.message,
      query: req.query.q || ''
    });
  }
});

// ================================================================
// 🎬 ENDPOINT: /api/lancamentos/filmes (Apenas lançamentos de filmes)
// ================================================================
app.get('/api/lancamentos/filmes', async (req, res) => {
  try {
    const { page = 1 } = req.query;

    console.log(`🎬 Buscando lançamentos de filmes - página ${page}`);

    // ===== CONSTRÓI A URL =====
    const url = page == 1 
      ? `${URL_BASE}/filmes/` 
      : `${URL_BASE}/filmes/page/${page}/`;

    // ===== FAZ A REQUISIÇÃO =====
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'Referer': `${URL_BASE}/`,
        ...(COOKIE_STRING && { Cookie: COOKIE_STRING })
      },
      timeout: 15000
    });

    const $ = cheerio.load(html);

    // ===== EXTRAI OS FILMES =====
    const filmes = [];

    // Pega os filmes do slider "Lançamentos"
    $('.vbTabSliderContainer .swiper-slide').each((i, el) => {
      const item = $(el);
      const link = item.find('a.block').attr('href') || '';
      const titulo = item.find('.info h3').text().trim() || '';
      const ano = item.find('.info p').text().trim() || '';
      const imagem = item.find('img').attr('src') || '';
      
      const tags = item.find('.top div');
      const qualidade = tags.eq(0).text().trim() || 'HD';
      const audio = tags.eq(1).text().trim() || '';

      const idMatch = link.match(/-(\d+)\/$/);
      const id = idMatch ? idMatch[1] : '';

      const slugMatch = link.match(/\/([^/]+)-\d+\/$/);
      const slug = slugMatch ? slugMatch[1] : '';

      filmes.push({
        id: id,
        slug: slug,
        titulo: titulo,
        ano: ano,
        imagem: imagem,
        qualidade: qualidade,
        audio: audio,
        link: link,
        link_assistir: link
      });
    });

    // ===== SE NÃO ACHOU NO SLIDER, PEGA DA LISTA PRINCIPAL =====
    if (filmes.length === 0) {
      $('.similarMovies a.block').each((i, el) => {
        const item = $(el);
        const link = item.attr('href') || '';
        const titulo = item.find('.info h3').text().trim() || '';
        const ano = item.find('.info p').text().trim() || '';
        const imagem = item.find('img').attr('src') || '';
        
        const tags = item.find('.top div');
        const qualidade = tags.eq(0).text().trim() || 'HD';
        const audio = tags.eq(1).text().trim() || '';

        const idMatch = link.match(/-(\d+)\/$/);
        const id = idMatch ? idMatch[1] : '';

        const slugMatch = link.match(/\/([^/]+)-\d+\/$/);
        const slug = slugMatch ? slugMatch[1] : '';

        filmes.push({
          id: id,
          slug: slug,
          titulo: titulo,
          ano: ano,
          imagem: imagem,
          qualidade: qualidade,
          audio: audio,
          link: link,
          link_assistir: link
        });
      });
    }

    // ===== EXTRAI TOTAL DE PÁGINAS =====
    let totalPaginas = 1;

    const lastPageLink = $('.ipsPagination_last a');
    if (lastPageLink.length) {
      const href = lastPageLink.attr('href') || '';
      const match = href.match(/page\/(\d+)\//);
      if (match) {
        totalPaginas = parseInt(match[1]) || 1;
      }
    }

    const hasNext = $('.ipsPagination_next:not(.ipsPagination_inactive)').length > 0;

    // ===== MONTA A RESPOSTA =====
    res.json({
      success: true,
      pagina_atual: parseInt(page),
      total_paginas: totalPaginas,
      has_next: hasNext,
      total: filmes.length,
      filmes: filmes
    });

    console.log(`✅ ${filmes.length} filmes encontrados`);

  } catch (error) {
    console.error('❌ Erro ao buscar filmes:', error.message);
    
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar lançamentos de filmes',
      detalhe: error.message
    });
  }
});

// ================================================================
// 📺 ENDPOINT: /api/novos-episodios (Novos episódios de séries)
// ================================================================
app.get('/api/novos-episodios', async (req, res) => {
  try {
    const { page = 1 } = req.query;

    console.log(`📺 Buscando novos episódios - página ${page}`);

    // ===== CONSTRÓI A URL =====
    const url = page == 1 
      ? `${URL_BASE}/series/` 
      : `${URL_BASE}/series/page/${page}/`;

    // ===== FAZ A REQUISIÇÃO =====
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'Referer': `${URL_BASE}/`,
        ...(COOKIE_STRING && { Cookie: COOKIE_STRING })
      },
      timeout: 15000
    });

    const $ = cheerio.load(html);

    // ===== EXTRAI AS SÉRIES DO SLIDER "NOVOS EPISÓDIOS" =====
    const series = [];

    $('.vbTabSliderContainer .swiper-slide').each((i, el) => {
      const item = $(el);
      const link = item.find('a.block').attr('href') || '';
      const titulo = item.find('.info h3').text().trim() || '';
      const ano = item.find('.info p').text().trim() || '';
      const imagem = item.find('img').attr('src') || '';
      
      const tags = item.find('.top div');
      const qualidade = tags.eq(0).text().trim() || 'HD';
      const audio = tags.eq(1).text().trim() || '';

      const idMatch = link.match(/-(\d+)\/$/);
      const id = idMatch ? idMatch[1] : '';

      const slugMatch = link.match(/\/([^/]+)-\d+\/$/);
      const slug = slugMatch ? slugMatch[1] : '';

      // Só adiciona se tiver título (ignora os vazios)
      if (titulo) {
        series.push({
          id: id,
          slug: slug,
          titulo: titulo,
          ano: ano,
          imagem: imagem,
          qualidade: qualidade,
          audio: audio,
          link: link,
          link_assistir: link
        });
      }
    });

    // ===== SE NÃO ACHOU NO SLIDER, PEGA DA LISTA PRINCIPAL =====
    if (series.length === 0) {
      $('.similarMovies a.block').each((i, el) => {
        const item = $(el);
        const link = item.attr('href') || '';
        const titulo = item.find('.info h3').text().trim() || '';
        const ano = item.find('.info p').text().trim() || '';
        const imagem = item.find('img').attr('src') || '';
        
        const tags = item.find('.top div');
        const qualidade = tags.eq(0).text().trim() || 'HD';
        const audio = tags.eq(1).text().trim() || '';

        const idMatch = link.match(/-(\d+)\/$/);
        const id = idMatch ? idMatch[1] : '';

        const slugMatch = link.match(/\/([^/]+)-\d+\/$/);
        const slug = slugMatch ? slugMatch[1] : '';

        if (titulo) {
          series.push({
            id: id,
            slug: slug,
            titulo: titulo,
            ano: ano,
            imagem: imagem,
            qualidade: qualidade,
            audio: audio,
            link: link,
            link_assistir: link
          });
        }
      });
    }

    // ===== EXTRAI TOTAL DE PÁGINAS =====
    let totalPaginas = 1;

    const lastPageLink = $('.ipsPagination_last a');
    if (lastPageLink.length) {
      const href = lastPageLink.attr('href') || '';
      const match = href.match(/page\/(\d+)\//);
      if (match) {
        totalPaginas = parseInt(match[1]) || 1;
      }
    }

    const hasNext = $('.ipsPagination_next:not(.ipsPagination_inactive)').length > 0;

    // ===== MONTA A RESPOSTA =====
    res.json({
      success: true,
      pagina_atual: parseInt(page),
      total_paginas: totalPaginas,
      has_next: hasNext,
      total: series.length,
      series: series
    });

    console.log(`✅ ${series.length} séries com novos episódios encontrados`);

  } catch (error) {
    console.error('❌ Erro ao buscar novos episódios:', error.message);
    
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar novos episódios',
      detalhe: error.message
    });
  }
});

// ================================================================
// 🎬 ENDPOINT: /api/filmes/stream (Busca TODOS os filmes com paginação)
// ================================================================
app.get('/api/filmes/stream', async (req, res) => {
  try {
    console.log('🎬 Buscando todos os filmes do PobreFlix...');
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    res.write('{\n  "fonte": "scraping",\n  "status": "carregando",\n  "filmes": [\n');

    let primeiro = true;
    let totalFilmes = 0;
    let pagina = 1;
    let temProxima = true;
    const maxPaginas = 187; // Total de páginas de filmes

    while (temProxima && pagina <= maxPaginas) {
      const url = pagina === 1 
        ? `${URL_BASE}/filmes/` 
        : `${URL_BASE}/filmes/page/${pagina}/`;
      
      console.log(`🎬 Buscando filmes página ${pagina}`);

      try {
        const { data: html } = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9',
            ...(COOKIE_STRING && { Cookie: COOKIE_STRING })
          },
          timeout: 15000
        });

        const $ = cheerio.load(html);
        
        // Pega os filmes da lista principal
        const itens = $('.similarMovies a.block');
        
        if (itens.length === 0) {
          console.log(`⚠️ Nenhum filme encontrado na página ${pagina}`);
          break;
        }

        itens.each((i, el) => {
          const item = $(el);
          const link = item.attr('href') || '';
          const titulo = item.find('.info h3').text().trim() || '';
          const ano = item.find('.info p').text().trim() || '';
          const imagem = item.find('img').attr('src') || '';
          
          const tags = item.find('.top div');
          const qualidade = tags.eq(0).text().trim() || 'HD';
          const audio = tags.eq(1).text().trim() || '';

          const idMatch = link.match(/-(\d+)\/$/);
          const id = idMatch ? idMatch[1] : '';

          const slugMatch = link.match(/\/([^/]+)-\d+\/$/);
          const slug = slugMatch ? slugMatch[1] : '';

          // Ignora itens vazios
          if (!titulo) return;

          const filme = {
            id: id,
            slug: slug,
            titulo: titulo,
            ano: ano,
            imagem: imagem,
            qualidade: qualidade,
            audio: audio,
            link: link,
            link_assistir: link
          };

          if (!primeiro) res.write(',\n');
          primeiro = false;
          res.write(JSON.stringify(filme, null, 2));
          totalFilmes++;
        });

        // Verifica se tem próxima página
        temProxima = $('.ipsPagination_next:not(.ipsPagination_inactive)').length > 0;

        console.log(`📄 Página ${pagina}: ${itens.length} filmes | Próxima: ${temProxima}`);
        pagina++;
        
        // Aguarda um pouco pra não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (err) {
        console.log(`❌ Erro na página ${pagina}:`, err.message);
        break;
      }
    }

    res.write('\n  ],\n');
    res.write(`  "total_filmes": ${totalFilmes},\n`);
    res.write(`  "paginas_processadas": ${pagina - 1},\n`);
    res.write(`  "status": "completo"\n`);
    res.write('}');
    res.end();
    
    console.log(`✅ Busca finalizada! ${totalFilmes} filmes encontrados em ${pagina - 1} páginas`);

  } catch (error) {
    console.error('❌ Erro no stream:', error);
    if (!res.headersSent) {
      res.status(500).json({ erro: 'Erro ao processar stream', detalhe: error.message });
    } else {
      res.write('\n  }],\n  "status": "erro"\n}');
      res.end();
    }
  }
});

// ================================================================
// 📺 ENDPOINT: /api/series/stream (Busca TODAS as séries com paginação)
// ================================================================
app.get('/api/series/stream', async (req, res) => {
  try {
    console.log('📺 Buscando todas as séries do PobreFlix...');
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    res.write('{\n  "fonte": "scraping",\n  "status": "carregando",\n  "series": [\n');

    let primeiro = true;
    let totalSeries = 0;
    let pagina = 1;
    let temProxima = true;
    const maxPaginas = 69; // Total de páginas de séries

    while (temProxima && pagina <= maxPaginas) {
      const url = pagina === 1 
        ? `${URL_BASE}/series/` 
        : `${URL_BASE}/series/page/${pagina}/`;
      
      console.log(`📺 Buscando séries página ${pagina}`);

      try {
        const { data: html } = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9',
            ...(COOKIE_STRING && { Cookie: COOKIE_STRING })
          },
          timeout: 15000
        });

        const $ = cheerio.load(html);
        
        const itens = $('.similarMovies a.block');
        
        if (itens.length === 0) {
          console.log(`⚠️ Nenhuma série encontrada na página ${pagina}`);
          break;
        }

        itens.each((i, el) => {
          const item = $(el);
          const link = item.attr('href') || '';
          const titulo = item.find('.info h3').text().trim() || '';
          const ano = item.find('.info p').text().trim() || '';
          const imagem = item.find('img').attr('src') || '';
          
          const tags = item.find('.top div');
          const qualidade = tags.eq(0).text().trim() || 'HD';
          const audio = tags.eq(1).text().trim() || '';

          const idMatch = link.match(/-(\d+)\/$/);
          const id = idMatch ? idMatch[1] : '';

          const slugMatch = link.match(/\/([^/]+)-\d+\/$/);
          const slug = slugMatch ? slugMatch[1] : '';

          if (!titulo) return;

          const serie = {
            id: id,
            slug: slug,
            titulo: titulo,
            ano: ano,
            imagem: imagem,
            qualidade: qualidade,
            audio: audio,
            link: link,
            link_assistir: link
          };

          if (!primeiro) res.write(',\n');
          primeiro = false;
          res.write(JSON.stringify(serie, null, 2));
          totalSeries++;
        });

        temProxima = $('.ipsPagination_next:not(.ipsPagination_inactive)').length > 0;

        console.log(`📄 Página ${pagina}: ${itens.length} séries | Próxima: ${temProxima}`);
        pagina++;
        
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (err) {
        console.log(`❌ Erro na página ${pagina}:`, err.message);
        break;
      }
    }

    res.write('\n  ],\n');
    res.write(`  "total_series": ${totalSeries},\n`);
    res.write(`  "paginas_processadas": ${pagina - 1},\n`);
    res.write(`  "status": "completo"\n`);
    res.write('}');
    res.end();
    
    console.log(`✅ Busca finalizada! ${totalSeries} séries encontradas em ${pagina - 1} páginas`);

  } catch (error) {
    console.error('❌ Erro no stream:', error);
    if (!res.headersSent) {
      res.status(500).json({ erro: 'Erro ao processar stream', detalhe: error.message });
    } else {
      res.write('\n  }],\n  "status": "erro"\n}');
      res.end();
    }
  }
});
