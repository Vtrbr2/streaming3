# 📚 SERVIDOR POBREFLIX - API DOCUMENTATION

## 🚀 VISÃO GERAL

Servidor API para scraping e busca de filmes e séries do **PobreFlix HD**. Fornece endpoints para busca automática, lançamentos, stream de conteúdo e seções da home.

---

## 📋 ENDPOINTS

### 🔍 Busca

#### `GET /api/buscar`

Busca automática com suporte a filtros e paginação. Ideal para **live search** enquanto o usuário digita.

**Parâmetros (query string):**

| Parâmetro | Tipo | Obrigatório | Padrão | Descrição |
|-----------|------|-------------|--------|-----------|
| `q` | string | ✅ Sim | - | Termo de busca (mínimo 2 caracteres) |
| `type` | string | ❌ Não | `todos` | `todos`, `filmes`, `series` |
| `genre` | string | ❌ Não | `` | Gênero (ex: `Ação`, `Comédia`) |
| `year` | string | ❌ Não | `` | Ano (ex: `2024`, `2023`) |
| `page` | number | ❌ Não | `1` | Número da página |

**Exemplo:**
```bash
curl "http://localhost:3000/api/buscar?q=garfield&type=filmes&page=1"
