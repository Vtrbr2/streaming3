// ================================================================
//                       🚀 SERVIDOR MAGFLIX
// ================================================================

const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();

// ================================================================
//                        ⚙️ CONFIGURAÇÕES
// ================================================================

const PORT = process.env.PORT || 3000;
const URL_BASE = 'https://www.pobreflixtv.gift';

// ================================================================
//                        🔓 CORS
// ================================================================

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());

// ================================================================
//                        🌐 COOKIES
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
// ================================================================
//                      🏠 ENDPOINTS DA HOME
// ================================================================
// ================================================================

// ================================================================
// 🏠 ENDPOINT: /api/banner-inicial
// ================================================================
app.get('/api/banner-inicial', (req, res) => {
  try {
    if (!HOME_HTML) {
      return res.status(503).json({
        success: false,
        error: 'Página inicial ainda não carregada. Aguarde alguns segundos.'
      });
    }

    console.log('🏠 Extraindo banner inicial...');

    const $ = cheerio.load(HOME_HTML);
    const banner = {};

    // Background do launcher
    const launcherBg = $('#launcherBg');
    const bgStyle = launcherBg.css('background-image') || '';
    const bgMatch = bgStyle.match(/url\(["']?([^"']*)["']?\)/);
    if (bgMatch) {
      banner.background_image = bgMatch[1];
    }

    // Logo do filme/série
    const movieLogo = $('.infos .movieLogo');
    if (movieLogo.length) {
      const logoDesktop = movieLogo.filter('.ipsResponsive_hidePhone');
      if (logoDesktop.length) {
        banner.logo = logoDesktop.attr('src') || '';
      } else {
        banner.logo = movieLogo.first().attr('src') || '';
      }
    }

    // Botão Assistir
    const assistirBtn = $('.infos .coolButton.orange');
    if (assistirBtn.length) {
      banner.link_assistir = assistirBtn.attr('href') || '';
      banner.titulo_botao = assistirBtn.text().trim() || 'Assistir';
    }

    // Determina tipo
    let tipo = 'filme';
    if (banner.link_assistir && banner.link_assistir.includes('/series/')) {
      tipo = 'serie';
    } else if (banner.link_assistir && banner.link_assistir.includes('/filmes/')) {
      tipo = 'filme';
    }

    // Extrai slug e ID
    let slug = '';
    let id = '';
    if (banner.link_assistir) {
      const slugMatch = banner.link_assistir.match(/\/([^/]+)-(\d+)\/$/);
      if (slugMatch) {
        slug = slugMatch[1];
        id = slugMatch[2];
      }
    }

    // Título
    let titulo = '';
    const tituloFromLink = banner.link_assistir ? banner.link_assistir.split('/').pop() : '';
    if (tituloFromLink) {
      const tituloMatch = tituloFromLink.match(/(.+?)-\d+$/);
      if (tituloMatch) {
        titulo = tituloMatch[1].replace(/-/g, ' ').trim();
      }
    }
    if (!titulo) {
      const logoAlt = $('.infos .movieLogo').attr('alt') || '';
      if (logoAlt && !logoAlt.includes('Assistir')) {
        titulo = logoAlt;
      }
    }

    res.json({
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
    });

    console.log(`✅ Banner extraído: "${titulo}" (${tipo})`);
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
// 🏠 ENDPOINT: /api/home/filmes/lancamentos
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
// 🏠 ENDPOINT: /api/home/filmes/recentes
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
// 🏠 ENDPOINT: /api/home/filmes/populares
// ================================================================
app.get('/api/home/filmes/populares', (req, res) => {
  try {
    if (!HOME_HTML) {
      return res.status(503).json({ success: false, error: 'Página inicial ainda não carregada.' });
    }

    const $ = cheerio.load(HOME_HTML);
    const filmes = [];

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

    res.json({
      success: true,
      total: filmes.length,
      filmes,
      mensagem: filmes.length === 0 ? 'Populares carregados via AJAX' : undefined
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ================================================================
// 🏠 ENDPOINT: /api/home/series/novos-episodios
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
// 🏠 ENDPOINT: /api/home/series/recentes
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
// 🏠 ENDPOINT: /api/home/series/populares
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

    res.json({
      success: true,
      total: series.length,
      series,
      mensagem: series.length === 0 ? 'Populares carregados via AJAX' : undefined
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ================================================================
// 🏠 ENDPOINT: /api/home/em-alta
// ================================================================
app.get('/api/home/em-alta', (req, res) => {
  try {
    if (!HOME_HTML) {
      return res.status(503).json({ success: false, error: 'Página inicial ainda não carregada.' });
    }

    const $ = cheerio.load(HOME_HTML);
    const itens = [];

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

    res.json({
      success: true,
      total: itens.length,
      itens,
      mensagem: itens.length === 0 ? 'EM ALTA carregado via AJAX' : undefined
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ================================================================
// 🏠 ENDPOINT: /api/home/categorias/filmes/:categoria
// ================================================================
app.get('/api/home/categorias/filmes/:categoria', async (req, res) => {
  try {
    const { categoria } = req.params;

    const categoriaMap = {
      'acao': 1,
      'comedia': 2,
      'ficcao-cientifica': 3
    };

    const slot = categoriaMap[categoria];

    if (!slot) {
      return res.status(400).json({
        success: false,
        error: 'Categoria inválida. Use: acao, comedia, ficcao-cientifica'
      });
    }

    const nomeCategoria = {
      1: 'Ação',
      2: 'Comédia',
      3: 'Ficção Científica'
    }[slot];

    if (!HOME_HTML) {
      return res.status(503).json({
        success: false,
        error: 'Página inicial ainda não carregada.'
      });
    }

    console.log(`📂 Buscando filmes de ${nomeCategoria}...`);

    const $ = cheerio.load(HOME_HTML);
    const csrfKey = $('input[name="csrfKey"]').val() || '60fc5ee14cba1a3523680a0df9a76111';

    const response = await axios.post(
      `${URL_BASE}/?app=core&module=system&controller=plugins&do=vbtabslidercategory`,
      new URLSearchParams({
        csrfKey: csrfKey,
        type: 'filmes',
        widgetKey: 'f7555hs6n',
        slot: slot
      }),
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'pt-BR,pt;q=0.9',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': `${URL_BASE}/`,
          ...(COOKIE_STRING && { Cookie: COOKIE_STRING })
        },
        timeout: 15000
      }
    );

    const htmlContent = response.data.content || '';
    const $$ = cheerio.load(htmlContent);

    const filmes = [];

    $$('.swiper-slide.vbTabSliderItem').each((i, el) => {
      const item = $$(el);
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

    res.json({
      success: true,
      categoria: nomeCategoria,
      tipo: 'filmes',
      slot: slot,
      total: filmes.length,
      filmes
    });

    console.log(`✅ ${filmes.length} filmes de ${nomeCategoria} encontrados`);
  } catch (error) {
    console.error('❌ Erro ao buscar categoria:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ================================================================
// 🏠 ENDPOINT: /api/home/categorias/series/:categoria
// ================================================================
app.get('/api/home/categorias/series/:categoria', async (req, res) => {
  try {
    const { categoria } = req.params;

    const categoriaMap = {
      'acao': 1,
      'comedia': 2,
      'ficcao-cientifica': 3
    };

    const slot = categoriaMap[categoria];

    if (!slot) {
      return res.status(400).json({
        success: false,
        error: 'Categoria inválida. Use: acao, comedia, ficcao-cientifica'
      });
    }

    const nomeCategoria = {
      1: 'Ação',
      2: 'Comédia',
      3: 'Ficção Científica'
    }[slot];

    if (!HOME_HTML) {
      return res.status(503).json({
        success: false,
        error: 'Página inicial ainda não carregada.'
      });
    }

    console.log(`📂 Buscando séries de ${nomeCategoria}...`);

    const $ = cheerio.load(HOME_HTML);
    const csrfKey = $('input[name="csrfKey"]').val() || '60fc5ee14cba1a3523680a0df9a76111';

    const response = await axios.post(
      `${URL_BASE}/?app=core&module=system&controller=plugins&do=vbtabslidercategory`,
      new URLSearchParams({
        csrfKey: csrfKey,
        type: 'series',
        widgetKey: 'f7555hs6n',
        slot: slot
      }),
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'pt-BR,pt;q=0.9',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': `${URL_BASE}/`,
          ...(COOKIE_STRING && { Cookie: COOKIE_STRING })
        },
        timeout: 15000
      }
    );

    const htmlContent = response.data.content || '';
    const $$ = cheerio.load(htmlContent);

    const series = [];

    $$('.swiper-slide.vbTabSliderItem').each((i, el) => {
      const item = $$(el);
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

    res.json({
      success: true,
      categoria: nomeCategoria,
      tipo: 'series',
      slot: slot,
      total: series.length,
      series
    });

    console.log(`✅ ${series.length} séries de ${nomeCategoria} encontradas`);
  } catch (error) {
    console.error('❌ Erro ao buscar categoria:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ================================================================
// ================================================================
//                      🔍 ENDPOINTS DE BUSCA
// ================================================================
// ================================================================

// ================================================================
// 🔍 ENDPOINT: /api/buscar
// ================================================================
app.get('/api/buscar', async (req, res) => {
  try {
    const { q, type = 'todos', genre = '', year = '', page = 1 } = req.query;

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

    const searchUrl = `${URL_BASE}/index.php?app=videobox&module=video&controller=index&do=buscarContent&q=${encodeURIComponent(q)}&type=${type}&genre=${genre}&year=${year}&page=${page}`;

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

    let htmlContent = data.html || data;

    if (typeof htmlContent === 'string' && htmlContent.startsWith('{')) {
      try {
        const parsed = JSON.parse(htmlContent);
        htmlContent = parsed.html || htmlContent;
      } catch (e) {}
    }

    const $ = cheerio.load(htmlContent);
    const results = [];

    $('.block').each((i, el) => {
      const item = $(el);
      const link = item.attr('href') || '';
      const titulo = item.find('.info h3').text().trim() || '';
      const ano = item.find('.info p').text().trim() || '';
      const imagem = item.find('img').attr('src') || '';
      const topTags = item.find('.top div');
      const qualidade = topTags.eq(0).text().trim() || 'HD';
      const audio = topTags.eq(1).text().trim() || '';

      let tipo = 'filme';
      if (link.includes('/series/')) {
        tipo = 'serie';
      } else if (link.includes('/filmes/')) {
        tipo = 'filme';
      }

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

    let totalPaginas = 1;
    let paginaAtual = parseInt(page) || 1;

    $('.ipsPagination_page a').each((i, el) => {
      const pageNum = parseInt($(el).text().trim());
      if (!isNaN(pageNum) && pageNum > totalPaginas) {
        totalPaginas = pageNum;
      }
    });

    const hasNext = $('.ipsPagination_next:not(.ipsPagination_inactive)').length > 0;

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
// ================================================================
//                      🎬 ENDPOINTS DE FILMES
// ================================================================
// ================================================================

// ================================================================
// 🎬 ENDPOINT: /api/lancamentos/filmes
// ================================================================
app.get('/api/lancamentos/filmes', async (req, res) => {
  try {
    const { page = 1 } = req.query;

    console.log(`🎬 Buscando lançamentos de filmes - página ${page}`);

    const url = page == 1
      ? `${URL_BASE}/filmes/`
      : `${URL_BASE}/filmes/page/${page}/`;

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
    const filmes = [];

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

      filmes.push({ id, slug, titulo, ano, imagem, qualidade, audio, link, link_assistir: link });
    });

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

        filmes.push({ id, slug, titulo, ano, imagem, qualidade, audio, link, link_assistir: link });
      });
    }

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
// 🎬 ENDPOINT: /api/filmes/stream
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
    const maxPaginas = 187;

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

          if (!titulo) return;

          const filme = { id, slug, titulo, ano, imagem, qualidade, audio, link, link_assistir: link };

          if (!primeiro) res.write(',\n');
          primeiro = false;
          res.write(JSON.stringify(filme, null, 2));
          totalFilmes++;
        });

        temProxima = $('.ipsPagination_next:not(.ipsPagination_inactive)').length > 0;

        console.log(`📄 Página ${pagina}: ${itens.length} filmes | Próxima: ${temProxima}`);
        pagina++;
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
// ================================================================
//                      📺 ENDPOINTS DE SÉRIES
// ================================================================
// ================================================================

// ================================================================
// 📺 ENDPOINT: /api/novos-episodios
// ================================================================
app.get('/api/novos-episodios', async (req, res) => {
  try {
    const { page = 1 } = req.query;

    console.log(`📺 Buscando novos episódios - página ${page}`);

    const url = page == 1
      ? `${URL_BASE}/series/`
      : `${URL_BASE}/series/page/${page}/`;

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

      if (titulo) {
        series.push({ id, slug, titulo, ano, imagem, qualidade, audio, link, link_assistir: link });
      }
    });

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
          series.push({ id, slug, titulo, ano, imagem, qualidade, audio, link, link_assistir: link });
        }
      });
    }

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
// 📺 ENDPOINT: /api/series/stream
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
    const maxPaginas = 69;

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

          const serie = { id, slug, titulo, ano, imagem, qualidade, audio, link, link_assistir: link };

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
// ================================================================
//                      🚀 INICIA O SERVIDOR
// ================================================================
// ================================================================

app.listen(PORT, () => {
  const now = new Date().toLocaleString("pt-BR");
  console.log("======================================");
  console.log("🚀 Servidor iniciado com sucesso");
  console.log(`🕒 Inicializado em: ${now}`);
  console.log(`🌐 Porta: ${PORT}`);
  console.log("======================================");
});
