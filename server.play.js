// ================================================================
//                       🎬 SERVIDOR MAGFLIX - PLAY
//             Extração de Stream + Proxy de Vídeo
// ================================================================

const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();

// ================================================================
//                        ⚙️ CONFIGURAÇÕES
// ================================================================

const PORT = process.env.PLAY_PORT || 3001;
const URL_BASE = 'https://www.pobreflixtv.moe';

// Mapeamento de servidores de embed
const SERVER_EMBED = {
  byse: 'https://bysebuho.com/e/',
  doodstream: 'https://doodstream.com/e/',
  mixdrop: 'https://mixdrop.co/e/',
  streamtape: 'https://streamtape.com/e/'
};

// ================================================================
//                        🔓 CORS
// ================================================================

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());

// ================================================================
//                        🌐 HEADER PADRÃO
// ================================================================

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9',
  'Accept-Encoding': 'identity',
  'Cache-Control': 'max-age=0',
  'Sec-CH-UA': '"Chromium";v="148", "Brave";v="148", "Not/A)Brand";v="99"',
  'Sec-CH-UA-Platform': '"Windows"'
};

// ================================================================
//                     📡 EXTRAIR EMBED URL
// ================================================================

/**
 * Carrega a página de assistir e extrai a URL do iframe do servidor selecionado.
 * @param {string} watchLink - URL completa da página de assistir
 * @param {string} server - Nome do servidor (byse, doodstream, mixdrop, streamtape)
 * @param {string} audio - Tipo de áudio (dub, leg)
 */
async function extrairEmbedUrl(watchLink, server = 'byse', audio = 'dub') {
  const watchHeaders = {
    ...DEFAULT_HEADERS,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate'
  };

  // 1. Carregar a página de assistir para pegar cookies
  const pageResp = await axios.get(watchLink, {
    headers: watchHeaders,
    timeout: 15000,
    maxRedirects: 5,
    validateStatus: status => status < 500
  });

  // Extrair cookies
  let cookieString = '';
  if (pageResp.headers['set-cookie']) {
    const cookieArray = Array.isArray(pageResp.headers['set-cookie'])
      ? pageResp.headers['set-cookie']
      : [pageResp.headers['set-cookie']];
    cookieString = cookieArray.map(c => c.split(';')[0]).join('; ');
  }

  // 2. Carregar a página novamente com cookies para obter o conteúdo completo
  const pageResp2 = await axios.get(watchLink, {
    headers: {
      ...watchHeaders,
      ...(cookieString && { Cookie: cookieString })
    },
    timeout: 15000,
    maxRedirects: 5,
    validateStatus: status => status < 500
  });

  const html = pageResp2.data;
  const $ = cheerio.load(html);

  // 3. O #view pode estar vazio no HTML estático - verificar se há iframe
  const viewIframes = $('#view iframe.player');
  if (viewIframes.length > 0) {
    const iframeSrc = viewIframes.first().attr('src');
    if (iframeSrc) {
      return {
        success: true,
        server: server,
        embedUrl: iframeSrc,
        message: 'Iframe encontrado no HTML estático'
      };
    }
  }

  // 4. Se o #view está vazio, o conteúdo é carregado via JS.
  // Precisamos acessar a página diretamente para o servidor selecionado.
  // Tentar acessar a URL com parâmetros do servidor
  const embedUrl = `${watchLink}?server=${server}&audio=${audio}`;

  try {
    const serverResp = await axios.get(embedUrl, {
      headers: {
        ...DEFAULT_HEADERS,
        ...(cookieString && { Cookie: cookieString })
      },
      timeout: 15000,
      maxRedirects: 5,
      validateStatus: status => status < 500
    });

    const serverHtml = serverResp.data;
    const $server = cheerio.load(serverHtml);

    // Verificar se há iframe no #view
    const serverIframes = $server('#view iframe.player');
    if (serverIframes.length > 0) {
      const src = serverIframes.first().attr('src');
      if (src) {
        return {
          success: true,
          server: server,
          embedUrl: src,
          message: 'Iframe encontrado via servidor'
        };
      }
    }

    // Tentar buscar iframe em qualquer lugar da página
    const allIframes = $server('iframe');
    for (let i = 0; i < allIframes.length; i++) {
      const src = $server(allIframes[i]).attr('src');
      if (src && src.includes(server) && src.includes('/e/')) {
        return {
          success: true,
          server: server,
          embedUrl: src,
          message: 'Iframe encontrado na página'
        };
      }
    }
  } catch (e) {
    // Ignorar erro e tentar abordagem alternativa
  }

  // 5. Abordagem: Extrair o ID do vídeo do link e montar a URL de embed
  // O link_assistir tem formato: /filmes/online/moana-dublado-72985/
  // O data-video-id é o ID numérico (72985)
  // O servidor gera um ID de embed dinâmico

  // Fallback: tentar montar a URL de embed do servidor padrão
  if (SERVER_EMBED[server]) {
    // O ID do vídeo é extraído do link
    const videoIdMatch = watchLink.match(/(\d+)\/?$/);
    if (videoIdMatch) {
      return {
        success: true,
        server: server,
        embedUrl: `${SERVER_EMBED[server]}${videoIdMatch[1]}`,
        message: 'URL montada a partir do video-id (fallback)'
      };
    }
  }

  return {
    success: false,
    message: 'Não foi possível extrair a URL de embed. O conteúdo do player pode ser carregado dinamicamente.',
    watchLink: watchLink,
    server: server,
    audio: audio
  };
}

// ================================================================
//                  🎬 EXTRAIR URL DO VÍDEO (MP4/M3U8)
// ================================================================

/**
 * Acessa a página de embed do servidor e tenta extrair a URL do vídeo.
 * Suporta Byse, DoodStream, MixDrop e Streamtape.
 */
async function extrairVideoUrl(embedUrl, server = 'byse') {
  try {
    // Adicionar cookies de embed se necessário
    const embedHeaders = {
      ...DEFAULT_HEADERS,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Referer': `${URL_BASE}/`
    };

    const embedResp = await axios.get(embedUrl, {
      headers: embedHeaders,
      timeout: 15000,
      maxRedirects: 10,
      validateStatus: status => status < 500,
      maxContentLength: 5 * 1024 * 1024 // 5MB max
    });

    const embedHtml = embedResp.data;
    const $ = cheerio.load(embedHtml);

    // Tentar encontrar a URL do vídeo de várias formas

    // 1. Buscar tags <video> e <source>
    const videoTags = $('video');
    if (videoTags.length > 0) {
      videoTags.each((i, el) => {
        const sources = $(el).find('source');
        sources.each((j, source) => {
          const src = $(source).attr('src');
          const type = $(source).attr('type');
          if (src) {
            // Resolver URL relativa
            try {
              const resolved = new URL(src, embedUrl).href;
              return { success: true, videoUrl: resolved, type: type || 'unknown' };
            } catch (e) {
              return { success: true, videoUrl: src, type: type || 'unknown' };
            }
          }
        });
      });
    }

    // 2. Buscar scripts com URL de vídeo (eval, document.write, etc.)
    const scripts = $('script');
    let videoUrl = null;
    let videoType = 'unknown';

    scripts.each((i, el) => {
      const text = $(el).text();
      
      // Padrão: eval, document.write, ou atribuição de URL
      const patterns = [
        // Padrão genérico: url com mp4/m3u8
        /["'](https?:\/\/[^"']*\.(?:mp4|m3u8|m3u|ts|webm)(?:\?[^"']*)?)["']/gi,
        // Padrão: fonte do vídeo em variável
        /(?:src|file|source|url|videoUrl)\s*[:=]\s*["'](https?:\/\/[^"']+)["']/gi,
        // Padrão eval com URL
        /eval\([^)]*["'](https?:\/\/[^"']+)["']/gi,
        // Padrão document.write
        /document\.write\([^)]*["'](https?:\/\/[^"']*)["']/gi,
        // Padrão de variável com URL de vídeo
        /var\s+\w+\s*=\s*["'](https?:\/\/[^"']*(?:mp4|m3u8)[^"']*)["']/gi,
        // Padrão: URL direta em string
        /["'](https?:\/\/[^"']*\.(?:mp4|m3u8)[^"']*)["']/gi,
        // Padrão: player source
        /source\s*[:=]\s*["'](https?:\/\/[^"']+)["']/gi,
        // Padrão: src do video
        /src\s*[:=]\s*["'](https?:\/\/[^"']*\.(?:mp4|m3u8|m3u|ts|webm))["']/gi
      ];

      for (const pattern of patterns) {
        const matches = text.match(pattern);
        if (matches) {
          for (const match of matches) {
            const urlMatch = match.match(/https?:\/\/[^"'=\s]+/);
            if (urlMatch) {
              videoUrl = urlMatch[0];
              if (videoUrl.includes('.m3u8')) videoType = 'm3u8';
              else if (videoUrl.includes('.mp4')) videoType = 'mp4';
              else if (videoUrl.includes('.webm')) videoType = 'webm';
              break;
            }
          }
          if (videoUrl) break;
        }
      }
    });

    if (videoUrl) {
      // Resolver URL relativa se necessário
      try {
        videoUrl = new URL(videoUrl, embedUrl).href;
      } catch (e) {
        // URL já absoluta
      }

      return {
        success: true,
        videoUrl: videoUrl,
        type: videoType,
        server: server,
        embedUrl: embedUrl,
        referer: embedUrl,
        message: 'URL do vídeo extraída com sucesso'
      };
    }

    // 3. Se não encontrou, verificar se o embed é um redirect
    const redirects = embedResp.request._redirects || [];
    if (redirects.length > 0) {
      const finalUrl = embedResp.request.res.responseUrl || embedUrl;
      if (finalUrl !== embedUrl) {
        return {
          success: true,
          videoUrl: finalUrl,
          type: 'redirect',
          server: server,
          embedUrl: embedUrl,
          message: 'URL de redirecionamento encontrada'
        };
      }
    }

    // 4. Fallback: retornar a URL de embed para uso direto com iframe
    return {
      success: true,
      embedUrl: embedUrl,
      server: server,
      type: 'embed',
      message: 'URL de embed retornada (uso direto com iframe)',
      note: 'O servidor pode usar proteções anti-scraping. Tente usar a embedUrl diretamente em um iframe.'
    };

  } catch (e) {
    return {
      success: false,
      message: `Erro ao extrair URL do vídeo: ${e.message}`,
      embedUrl: embedUrl,
      server: server
    };
  }
}

// ================================================================
//                    🎬 PROXY DE VÍDEO
// ================================================================

/**
 * Proxy que faz streaming de vídeo, suportando range requests (seek).
 */
app.get('/api/proxy/video', async (req, res) => {
  try {
    const { url, referer } = req.query;

    if (!url) {
      return res.status(400).json({ success: false, message: 'Parâmetro "url" é obrigatório' });
    }

    // Decode a URL
    const videoUrl = decodeURIComponent(url);
    const videoReferer = referer ? decodeURIComponent(referer) : null;

    // Headers da requisição ao servidor de vídeo
    const proxyHeaders = {
      'User-Agent': DEFAULT_HEADERS['User-Agent'],
      'Accept': 'video/*,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9',
      ...(referer && { Referer: videoReferer }),
      ...(referer && { Origin: new URL(videoReferer).origin }),
      'Sec-Fetch-Dest': 'video',
      'Sec-Fetch-Mode': 'no-cors',
      'Range': req.headers['range'] || ''
    };

    // Requisição ao servidor de vídeo
    const videoResp = await axios({
      method: 'get',
      url: videoUrl,
      headers: proxyHeaders,
      responseType: 'stream',
      timeout: 30000,
      maxRedirects: 5,
      validateStatus: status => status < 500
    });

    // Configurar headers de resposta
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    // Se a resposta suportar range
    if (videoResp.status === 206 || req.headers['range']) {
      const contentRange = videoResp.headers['content-range'];
      const contentLength = videoResp.headers['content-length'];
      const acceptRanges = videoResp.headers['accept-ranges'];
      const contentType = videoResp.headers['content-type'] || 'video/mp4';

      if (contentRange) {
        res.setHeader('Content-Range', contentRange);
      }
      if (acceptRanges) {
        res.setHeader('Accept-Ranges', 'bytes');
      }
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }
      res.setHeader('Content-Type', contentType);
      res.status(videoResp.status);

      videoResp.data.pipe(res);
    } else {
      // Resposta completa sem range
      const contentLength = videoResp.headers['content-length'];
      const contentType = videoResp.headers['content-type'] || 'video/mp4';

      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', contentType);
      res.status(200);

      videoResp.data.pipe(res);
    }

  } catch (e) {
    console.error('Erro no proxy de vídeo:', e.message);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: `Erro no proxy de vídeo: ${e.message}`
      });
    }
  }
});

// ================================================================
//              🎬 PROXY DE MANIFEST (M3U8/HLS)
// ================================================================

app.get('/api/proxy/manifest', async (req, res) => {
  try {
    const { url, referer } = req.query;

    if (!url) {
      return res.status(400).json({ success: false, message: 'Parâmetro "url" é obrigatório' });
    }

    const manifestUrl = decodeURIComponent(url);
    const manifestReferer = referer ? decodeURIComponent(referer) : null;

    const proxyHeaders = {
      'User-Agent': DEFAULT_HEADERS['User-Agent'],
      'Accept': '*/*',
      'Accept-Language': 'pt-BR,pt;q=0.9',
      ...(manifestReferer && { Referer: manifestReferer }),
      ...(manifestReferer && { Origin: new URL(manifestReferer).origin }),
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors'
    };

    const manifestResp = await axios.get(manifestUrl, {
      headers: proxyHeaders,
      timeout: 15000,
      maxRedirects: 5,
      validateStatus: status => status < 500
    });

    const manifestContent = manifestResp.data;
    const contentType = manifestResp.headers['content-type'] || 'application/vnd.apple.mpegurl';

    // Reescrever URLs relativas no manifest para usar o proxy
    let rewrittenContent = manifestContent;

    // Substituir URLs de segmentos TS
    const baseUrl = new URL(manifestUrl);
    const origin = baseUrl.origin;

    // Pattern para linhas que contêm URLs de segmentos (.ts, .m3u8)
    const segmentPattern = /^(?!#)(?!EXT)(.*)$/gm;
    rewrittenContent = manifestContent.replace(segmentPattern, (match) => {
      const trimmed = match.trim();
      if (!trimmed) return match;
      if (trimmed.startsWith('#')) return match;

      let absoluteUrl = trimmed;
      if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
        absoluteUrl = new URL(trimmed, manifestUrl).href;
      }

      if (trimmed.endsWith('.ts')) {
        return `/api/proxy/segment?url=${encodeURIComponent(absoluteUrl)}${manifestReferer ? `&referer=${encodeURIComponent(manifestReferer)}` : ''}`;
      } else if (trimmed.endsWith('.m3u8')) {
        return `/api/proxy/manifest?url=${encodeURIComponent(absoluteUrl)}${manifestReferer ? `&referer=${encodeURIComponent(manifestReferer)}` : ''}`;
      }
      return match;
    });

    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(rewrittenContent);

  } catch (e) {
    console.error('Erro no proxy de manifest:', e.message);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: `Erro no proxy de manifest: ${e.message}`
      });
    }
  }
});

// ================================================================
//              🎬 PROXY DE SEGMENTO (TS)
// ================================================================

app.get('/api/proxy/segment', async (req, res) => {
  try {
    const { url, referer } = req.query;

    if (!url) {
      return res.status(400).json({ success: false, message: 'Parâmetro "url" é obrigatório' });
    }

    const segmentUrl = decodeURIComponent(url);
    const segmentReferer = referer ? decodeURIComponent(referer) : null;

    const proxyHeaders = {
      'User-Agent': DEFAULT_HEADERS['User-Agent'],
      'Accept': '*/*',
      'Accept-Language': 'pt-BR,pt;q=0.9',
      ...(segmentReferer && { Referer: segmentReferer }),
      ...(segmentReferer && { Origin: new URL(segmentReferer).origin }),
      'Sec-Fetch-Dest': 'video',
      'Sec-Fetch-Mode': 'no-cors',
      'Range': req.headers['range'] || ''
    };

    const segmentResp = await axios({
      method: 'get',
      url: segmentUrl,
      headers: proxyHeaders,
      responseType: 'stream',
      timeout: 30000,
      maxRedirects: 5,
      validateStatus: status => status < 500
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    const contentLength = segmentResp.headers['content-length'];
    const contentType = segmentResp.headers['content-type'] || 'video/mp2t';

    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }
    res.setHeader('Content-Type', contentType);

    if (segmentResp.headers['content-range']) {
      res.setHeader('Content-Range', segmentResp.headers['content-range']);
    }

    res.status(segmentResp.status);
    segmentResp.data.pipe(res);

  } catch (e) {
    console.error('Erro no proxy de segmento:', e.message);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: `Erro no proxy de segmento: ${e.message}`
      });
    }
  }
});

// ================================================================
//              🎬 EXTRAIR STREAM URL
// ================================================================

/**
 * Endpoint principal: recebe o link de assistir e retorna a URL do stream.
 * 
 * @param {string} watchLink - URL da página de assistir (ex: /filmes/online/moana-dublado-72985/)
 * @param {string} server - Servidor (byse, doodstream, mixdrop, streamtape)
 * @param {string} audio - Tipo de áudio (dub, leg)
 */
app.get('/api/stream/extract', async (req, res) => {
  try {
    const { watchLink, server, audio } = req.query;

    if (!watchLink) {
      return res.status(400).json({
        success: false,
        message: 'Parâmetro "watchLink" é obrigatório. Exemplo: /filmes/online/moana-dublado-72985/'
      });
    }

    const selectedServer = server || 'byse';
    const selectedAudio = audio || 'dub';

    // Construir URL completa se necessário
    let fullWatchLink = watchLink;
    if (!watchLink.startsWith('http://') && !watchLink.startsWith('https://')) {
      fullWatchLink = `${URL_BASE}${watchLink}`;
    }

    // Extrair embed URL
    const embedResult = await extrairEmbedUrl(fullWatchLink, selectedServer, selectedAudio);

    if (!embedResult.success) {
      return res.status(500).json(embedResult);
    }

    // Extrair URL do vídeo a partir da embed URL
    const videoResult = await extrairVideoUrl(embedResult.embedUrl, selectedServer);

    res.json({
      success: true,
      server: selectedServer,
      audio: selectedAudio,
      watchLink: fullWatchLink,
      embedUrl: embedResult.embedUrl,
      proxyVideoUrl: `/api/proxy/video?url=${encodeURIComponent(videoResult.videoUrl || videoResult.embedUrl)}${videoResult.referer ? `&referer=${encodeURIComponent(videoResult.referer)}` : ''}`,
      ...videoResult
    });

  } catch (e) {
    console.error('Erro ao extrair stream:', e.message);
    res.status(500).json({
      success: false,
      message: `Erro ao extrair stream: ${e.message}`
    });
  }
});

// ================================================================
//              🎬 GET EMBED URL (sem extrair vídeo)
// ================================================================

/**
 * Retorna apenas a URL de embed do servidor selecionado.
 * Útil para usar diretamente em iframe no frontend.
 */
app.get('/api/stream/embed', async (req, res) => {
  try {
    const { watchLink, server, audio } = req.query;

    if (!watchLink) {
      return res.status(400).json({
        success: false,
        message: 'Parâmetro "watchLink" é obrigatório'
      });
    }

    const selectedServer = server || 'byse';
    const selectedAudio = audio || 'dub';

    let fullWatchLink = watchLink;
    if (!watchLink.startsWith('http://') && !watchLink.startsWith('https://')) {
      fullWatchLink = `${URL_BASE}${watchLink}`;
    }

    const result = await extrairEmbedUrl(fullWatchLink, selectedServer, selectedAudio);
    res.json(result);

  } catch (e) {
    console.error('Erro ao extrair embed:', e.message);
    res.status(500).json({
      success: false,
      message: `Erro ao extrair embed: ${e.message}`
    });
  }
});

// ================================================================
//              🎬 LISTAR SERVIDORES DISPONÍVEIS
// ================================================================

/**
 * Carrega a página de assistir e lista todos os servidores disponíveis.
 */
app.get('/api/stream/servers', async (req, res) => {
  try {
    const { watchLink } = req.query;

    if (!watchLink) {
      return res.status(400).json({
        success: false,
        message: 'Parâmetro "watchLink" é obrigatório'
      });
    }

    let fullWatchLink = watchLink;
    if (!watchLink.startsWith('http://') && !watchLink.startsWith('https://')) {
      fullWatchLink = `${URL_BASE}${watchLink}`;
    }

    const pageResp = await axios.get(fullWatchLink, {
      headers: {
        ...DEFAULT_HEADERS,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
      },
      timeout: 15000,
      maxRedirects: 5,
      validateStatus: status => status < 500
    });

    // Extrair cookies
    let cookieString = '';
    if (pageResp.headers['set-cookie']) {
      const cookieArray = Array.isArray(pageResp.headers['set-cookie'])
        ? pageResp.headers['set-cookie']
        : [pageResp.headers['set-cookie']];
      cookieString = cookieArray.map(c => c.split(';')[0]).join('; ');
    }

    // Carregar com cookies
    const pageResp2 = await axios.get(fullWatchLink, {
      headers: {
        ...DEFAULT_HEADERS,
        ...(cookieString && { Cookie: cookieString })
      },
      timeout: 15000,
      maxRedirects: 5,
      validateStatus: status => status < 500
    });

    const html = pageResp2.data;
    const $ = cheerio.load(html);

    // Buscar abas de áudio
    const audios = [];
    $('.tabs .item').each((i, el) => {
      audios.push({
        name: $(el).text().trim(),
        value: $(el).attr('data-audio')
      });
    });

    // Buscar servidores
    const servers = [];
    $('.server[data-server]').each((i, el) => {
      const serverName = $(el).attr('data-server');
      const name = $(el).find('.name').text().trim();
      const number = $(el).find('.number').text().trim();
      const active = $(el).hasClass('active');
      servers.push({
        key: serverName,
        name: name,
        number: number,
        active: active,
        embedUrl: SERVER_EMBED[serverName] || null
      });
    });

    // Buscar video-id
    const viewDiv = $('#view');
    const videoId = viewDiv.attr('data-video-id') || '';
    const tmdbId = viewDiv.attr('data-tmdb-id') || '';

    res.json({
      success: true,
      watchLink: fullWatchLink,
      videoId: videoId,
      tmdbId: tmdbId,
      audios: audios,
      servers: servers
    });

  } catch (e) {
    console.error('Erro ao listar servidores:', e.message);
    res.status(500).json({
      success: false,
      message: `Erro ao listar servidores: ${e.message}`
    });
  }
});

// ================================================================
//                    📋 INFO DO ENDPOINT
// ================================================================

app.get('/', (req, res) => {
  res.json({
    name: 'Magflix Play Server',
    version: '1.0.0',
    description: 'API para extração de stream e proxy de vídeo do PobreFlix',
    endpoints: {
      'GET /api/stream/extract': 'Extrai URL do vídeo a partir do link de assistir',
      'GET /api/stream/embed': 'Retorna URL de embed do servidor',
      'GET /api/stream/servers': 'Lista servidores disponíveis',
      'GET /api/proxy/video': 'Proxy de vídeo (streaming com range)',
      'GET /api/proxy/manifest': 'Proxy de manifest HLS (m3u8)',
      'GET /api/proxy/segment': 'Proxy de segmento de vídeo (.ts)'
    },
    usage: {
      extract: 'GET /api/stream/extract?watchLink=/filmes/online/moana-dublado-72985/&server=byse&audio=dub',
      embed: 'GET /api/stream/embed?watchLink=/filmes/online/moana-dublado-72985/&server=byse&audio=dub',
      servers: 'GET /api/stream/servers?watchLink=/filmes/online/moana-dublado-72985/',
      proxy: 'GET /api/proxy/video?url=ENCODED_VIDEO_URL&referer=ENCODED_REFERER'
    }
  });
});

// ================================================================
// 🚀 INICIA O SERVIDOR
// ================================================================

app.listen(PORT, () => {
  const now = new Date().toLocaleString("pt-BR");
  console.log("======================================");
  console.log("🎬 Servidor Play Magflix iniciado");
  console.log(`🕒 Inicializado em: ${now}`);
  console.log(`🌐 Porta: ${PORT}`);
  console.log(`🔗 URL Base: ${URL_BASE}`);
  console.log("======================================");
});

module.exports = app;
