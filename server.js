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
//                        🌐 COOKIES (compartilhado)
// ================================================================

let COOKIE_STRING = '';

// ================================================================
//                        📄 HTML BASE
// ================================================================

let HOME_HTML = '';
// ================================================================
// 🌐 CARREGAMENTO HOME
// ================================================================
async function carregarHome() {
  try {
    console.log('🌐 Carregando página inicial...');
    const response = await axios.get(`${URL_BASE}/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Cache-Control': 'max-age=0',
        'Sec-CH-UA': '"Chromium";v="148", "Brave";v="148", "Not/A)Brand";v="99"',
        'Sec-CH-UA-Mobile': '?0',
        'Sec-CH-UA-Platform': '"Windows"',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Sec-GPC': '1',
        'Priority': 'u=0,i'
      },
      timeout: 15000,
      maxRedirects: 5,
      validateStatus: status => status < 500
    });

    HOME_HTML = response.data || '';
    const setCookie = response.headers['set-cookie'];
    if (setCookie && setCookie.length > 0) {
      const cookieArray = Array.isArray(setCookie) ? setCookie : [setCookie];
      COOKIE_STRING = cookieArray.map(cookie => cookie.split(';')[0]).join('; ');
      console.log('🍪 Cookies obtidos:', COOKIE_STRING);
    } else {
      COOKIE_STRING = '';
      console.warn('⚠️ Nenhum cookie retornado pelo servidor.');
    }
    console.log(`📄 HTML carregado: ${HOME_HTML.length} bytes`);
    console.log('✅ Página inicial carregada com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao carregar home:', error.message);
  }
}

carregarHome();
setInterval(carregarHome, 6 * 60 * 60 * 1000);


// ================================================================
// 🏠 ENDPOINT: /api/banner-inicial (Banner principal da home)
// ================================================================
app.get('/api/banner-inicial', (req, res) => {
  try {
    // Verifica se o HTML da home foi carregado
    if (!HOME_HTML) {
      return res.status(503).json({
        success: false,
        error: 'Página inicial ainda não carregada. Aguarde alguns segundos.'
      });
    }

    console.log('🏠 Extraindo banner inicial...');

    const $ = cheerio.load(HOME_HTML);

    // ===== EXTRAI O BANNER =====
    const banner = {};

    // 1. Pega o background-image do launcher
    const launcherBg = $('#launcherBg');
    const bgStyle = launcherBg.css('background-image') || '';
    const bgMatch = bgStyle.match(/url\(["']?([^"']*)["']?\)/);
    if (bgMatch) {
      banner.background_image = bgMatch[1];
    }

    // 2. Pega o logo do filme/série
    const movieLogo = $('.infos .movieLogo');
    if (movieLogo.length) {
      // Pega a logo de desktop (primeira)
      const logoDesktop = movieLogo.filter('.ipsResponsive_hidePhone');
      if (logoDesktop.length) {
        banner.logo = logoDesktop.attr('src') || '';
      } else {
        banner.logo = movieLogo.first().attr('src') || '';
      }
    }

    // 3. Pega o link do botão "Assistir"
    const assistirBtn = $('.infos .coolButton.orange');
    if (assistirBtn.length) {
      banner.link_assistir = assistirBtn.attr('href') || '';
      banner.titulo_botao = assistirBtn.text().trim() || 'Assistir';
    }

    // 4. Determina o tipo (filme ou série) pelo link
    let tipo = 'filme';
    if (banner.link_assistir && banner.link_assistir.includes('/series/')) {
      tipo = 'serie';
    } else if (banner.link_assistir && banner.link_assistir.includes('/filmes/')) {
      tipo = 'filme';
    }

    // 5. Extrai o slug e ID do link
    let slug = '';
    let id = '';
    if (banner.link_assistir) {
      const slugMatch = banner.link_assistir.match(/\/([^/]+)-(\d+)\/$/);
      if (slugMatch) {
        slug = slugMatch[1];
        id = slugMatch[2];
      }
    }

    // 6. Pega o título do filme/série (do link ou do alt da imagem)
    let titulo = '';
    const tituloFromLink = banner.link_assistir ? banner.link_assistir.split('/').pop() : '';
    if (tituloFromLink) {
      const tituloMatch = tituloFromLink.match(/(.+?)-\d+$/);
      if (tituloMatch) {
        titulo = tituloMatch[1].replace(/-/g, ' ').trim();
      }
    }

    // Se não achou, tenta do alt da imagem
    if (!titulo) {
      const logoAlt = $('.infos .movieLogo').attr('alt') || '';
      if (logoAlt && !logoAlt.includes('Assistir')) {
        titulo = logoAlt;
      }
    }

    // ===== MONTA A RESPOSTA =====
    const response = {
      success: true,
      banner: {
        titulo: titulo,
        tipo: tipo,
        slug: slug,
        id: id,
        logo: banner.logo || null,
        background_image: banner.background_image || null,
        link_assistir: banner.link_assistir || null,
        texto_botao: banner.titulo_botao || 'Assistir'
      }
    };

    console.log(`✅ Banner extraído: "${titulo}" (${tipo})`);
    res.json(response);

  } catch (error) {
    console.error('❌ Erro ao extrair banner:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erro ao extrair banner inicial',
      detalhe: error.message
    });
  }
});

// ================================================================
// 🏠 ENDPOINT: /api/home/filmes (Filmes do slider da home)
// ================================================================
app.get('/api/home/filmes', (req, res) => {
  try {
    // Verifica se o HTML da home foi carregado
    if (!HOME_HTML) {
      return res.status(503).json({
        success: false,
        error: 'Página inicial ainda não carregada. Aguarde alguns segundos.'
      });
    }

    console.log('🏠 Extraindo filmes da home...');

    const $ = cheerio.load(HOME_HTML);
    const filmes = [];

    // ===== BUSCA O SLIDER DE FILMES (Lançamentos) =====
    // O slider de filmes está dentro do painel 'releases_kw8a73lf1_html'
    const filmesContainer = $('.vbPanel-container.releases_kw8a73lf1_html');
    
    if (filmesContainer.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Slider de filmes não encontrado na home'
      });
    }

    // Pega todos os slides
    filmesContainer.find('.swiper-slide.vbTabSliderItem').each((i, el) => {
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

      // Só adiciona se tiver título
      if (titulo) {
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
      }
    });

    // ===== MONTA A RESPOSTA =====
    const response = {
      success: true,
      total: filmes.length,
      filmes: filmes
    };

    console.log(`✅ ${filmes.length} filmes extraídos da home`);
    res.json(response);

  } catch (error) {
    console.error('❌ Erro ao extrair filmes da home:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erro ao extrair filmes da home',
      detalhe: error.message
    });
  }
});

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
// ================================================================
// 🏠 ENDPOINT: /api/home/filmes/lancamentos (Lançamentos de filmes)
// ================================================================
app.get('/api/home/filmes/lancamentos', (req, res) => {
  try {
    if (!HOME_HTML) {
      return res.status(503).json({ success: false, error: 'Página inicial ainda não carregada.' });
    }

    const $ = cheerio.load(HOME_HTML);
    const filmes = [];

    $('.vbPanel-container.releases_kw8a73lf1_html .swiper-slide.vbTabSliderItem').each((i, el) => {
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

      if (titulo) {
        filmes.push({ id, slug, titulo, ano, imagem, qualidade, audio, link, link_assistir: link });
      }
    });

    res.json({ success: true, total: filmes.length, filmes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ================================================================
// 🏠 ENDPOINT: /api/home/filmes/recentes (Recentes de filmes)
// ================================================================
app.get('/api/home/filmes/recentes', (req, res) => {
  try {
    if (!HOME_HTML) {
      return res.status(503).json({ success: false, error: 'Página inicial ainda não carregada.' });
    }

    const $ = cheerio.load(HOME_HTML);
    const filmes = [];

    $('.vbPanel-container.latest_kw8a73lf1_html .swiper-slide.vbTabSliderItem').each((i, el) => {
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

      if (titulo) {
        filmes.push({ id, slug, titulo, ano, imagem, qualidade, audio, link, link_assistir: link });
      }
    });

    res.json({ success: true, total: filmes.length, filmes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ================================================================
// 🏠 ENDPOINT: /api/home/filmes/populares (Populares de filmes)
// ================================================================
app.get('/api/home/filmes/populares', (req, res) => {
  try {
    if (!HOME_HTML) {
      return res.status(503).json({ success: false, error: 'Página inicial ainda não carregada.' });
    }

    const $ = cheerio.load(HOME_HTML);
    const filmes = [];

    // Populares é carregado via AJAX, então vem com .ipsLoading
    // Tentamos pegar da estrutura se já estiver carregado
    $('.vbPanel-container.mostviewed_kw8a73lf1_html .swiper-slide.vbTabSliderItem').each((i, el) => {
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

      if (titulo) {
        filmes.push({ id, slug, titulo, ano, imagem, qualidade, audio, link, link_assistir: link });
      }
    });

    // Se não encontrou, retorna vazio (será carregado via AJAX)
    res.json({ success: true, total: filmes.length, filmes, mensagem: filmes.length === 0 ? 'Populares carregados via AJAX' : undefined });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ================================================================
// 📺 ENDPOINT: /api/home/series/novos-episodios (Novos episódios)
// ================================================================
app.get('/api/home/series/novos-episodios', (req, res) => {
  try {
    if (!HOME_HTML) {
      return res.status(503).json({ success: false, error: 'Página inicial ainda não carregada.' });
    }

    const $ = cheerio.load(HOME_HTML);
    const series = [];

    $('.vbPanel-container.releases_n8tzjhutr_html .swiper-slide.vbTabSliderItem').each((i, el) => {
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

      if (titulo) {
        series.push({ id, slug, titulo, ano, imagem, qualidade, audio, link, link_assistir: link });
      }
    });

    res.json({ success: true, total: series.length, series });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ================================================================
// 📺 ENDPOINT: /api/home/series/recentes (Recentes de séries)
// ================================================================
app.get('/api/home/series/recentes', (req, res) => {
  try {
    if (!HOME_HTML) {
      return res.status(503).json({ success: false, error: 'Página inicial ainda não carregada.' });
    }

    const $ = cheerio.load(HOME_HTML);
    const series = [];

    $('.vbPanel-container.latest_n8tzjhutr_html .swiper-slide.vbTabSliderItem').each((i, el) => {
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

      if (titulo) {
        series.push({ id, slug, titulo, ano, imagem, qualidade, audio, link, link_assistir: link });
      }
    });

    res.json({ success: true, total: series.length, series });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ================================================================
// 📺 ENDPOINT: /api/home/series/populares (Populares de séries)
// ================================================================
app.get('/api/home/series/populares', (req, res) => {
  try {
    if (!HOME_HTML) {
      return res.status(503).json({ success: false, error: 'Página inicial ainda não carregada.' });
    }

    const $ = cheerio.load(HOME_HTML);
    const series = [];

    $('.vbPanel-container.mostviewed_n8tzjhutr_html .swiper-slide.vbTabSliderItem').each((i, el) => {
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

      if (titulo) {
        series.push({ id, slug, titulo, ano, imagem, qualidade, audio, link, link_assistir: link });
      }
    });

    res.json({ success: true, total: series.length, series, mensagem: series.length === 0 ? 'Populares carregados via AJAX' : undefined });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ================================================================
// 🔥 ENDPOINT: /api/home/em-alta (EM ALTA!)
// ================================================================
app.get('/api/home/em-alta', (req, res) => {
  try {
    if (!HOME_HTML) {
      return res.status(503).json({ success: false, error: 'Página inicial ainda não carregada.' });
    }

    const $ = cheerio.load(HOME_HTML);
    const itens = [];

    // EM ALTA é carregado via AJAX, então tentamos pegar se já estiver carregado
    $('.vbSection-body.nqwss1i8m_body .swiper-slide').each((i, el) => {
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

      let tipo = 'filme';
      if (link.includes('/series/')) tipo = 'serie';

      if (titulo) {
        itens.push({ id, slug, titulo, ano, imagem, qualidade, audio, tipo, link, link_assistir: link });
      }
    });

    res.json({ success: true, total: itens.length, itens, mensagem: itens.length === 0 ? 'EM ALTA carregado via AJAX' : undefined });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

