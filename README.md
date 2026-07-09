
# 🎬 PobreFlix API

API responsável pelo backend do **scraping de
https://topfilmes.biz/**, fornecendo banners, catálogo, buscas, filmes, séries e streaming.

---

# 📌 Endpoints

## 🏠 Home

Endpoints utilizados na tela inicial.

| Endpoint | Descrição |
|----------|-----------|
| `/api/banner-inicial` | Banner principal da Home |
| `/api/home/filmes` | Lançamentos de filmes (compatibilidade) |
| `/api/home/filmes/lancamentos` | Lançamentos de filmes |
| `/api/home/filmes/recentes` | Filmes recentes |
| `/api/home/filmes/populares` | Filmes populares |
| `/api/home/series/novos-episodios` | Novos episódios |
| `/api/home/series/recentes` | Séries recentes |
| `/api/home/series/populares` | Séries populares |
| `/api/home/em-alta` | Conteúdo em alta (Filmes + Séries) |

---

## 🔍 Busca

| Endpoint | Descrição |
|----------|-----------|
| `/api/buscar` | Busca dinâmica (Live Search) |

---

## 🎬 Filmes

| Endpoint | Descrição |
|----------|-----------|
| `/api/lancamentos/filmes` | Lançamentos de filmes (paginado) |
| `/api/filmes/stream` | Streaming de todos os filmes |

---

## 📺 Séries

| Endpoint | Descrição |
|----------|-----------|
| `/api/novos-episodios` | Novos episódios (paginado) |
| `/api/series/stream` | Streaming de todas as séries |

---

# 📋 Resumo da Home

| Categoria | Lançamentos | Recentes | Populares |
|-----------|-------------|----------|-----------|
| 🎬 Filmes | `/api/home/filmes/lancamentos` | `/api/home/filmes/recentes` | `/api/home/filmes/populares` |
| 📺 Séries | `/api/home/series/novos-episodios` | `/api/home/series/recentes` | `/api/home/series/populares` |

---

# 🚀 Recursos

- ✅ Banner inicial
- ✅ Catálogo de filmes
- ✅ Catálogo de séries
- ✅ Busca em tempo real
- ✅ Streaming de filmes
- ✅ Streaming de séries
- ✅ Conteúdo em alta
- ✅ Lançamentos
- ✅ Conteúdo recente
- ✅ Conteúdo popular

---

## 📦 Estrutura da API

```
/
├── Home
│   ├── Banner Inicial
│   ├── Filmes
│   ├── Séries
│   └── Em Alta
│
├── Busca
│
├── Filmes
│   ├── Lançamentos
│   └── Stream
│
└── Séries
    ├── Novos Episódios
    └── Stream
```
