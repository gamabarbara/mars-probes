# Mars Probes

## Executar com Docker Compose

Com Docker em execução e Docker Compose instalado, execute na raiz do clone:

```sh
docker compose up --build
```

- React em [localhost:5173](http://localhost:5173).
- Documentação do FastAPI em [localhost:8000/docs](http://localhost:8000/docs).

As imagens usam Python 3.13 e Node.js 24. A API grava as sondas em `/data/probes.sqlite3`, no volume `probe-data`. O volume é preservado ao reiniciar o backend e ao parar os serviços com `docker compose down`.

### Demonstrar o fluxo

1. No React, lance duas sondas com direção **North** e limites `(2, 2)` e `(4, 3)`. Em um banco vazio, a lista mostra dois IDs distintos e o mapa exibe `2` na origem.
2. Selecione a sonda com limites `(2, 2)` e envie `MRM`. Confira a posição `(1, 1)` e a direção **East**. A outra sonda permanece na origem.
3. Envie `LMM` à mesma sonda. O terceiro comando ultrapassa a malha. A interface mostra o erro e preserva a posição `(1, 1)` e a direção **East**.
4. Execute `docker compose restart backend`, recarregue o React e selecione as sondas novamente. Confira os mesmos IDs, posições, direções e limites. A consulta `GET /probes/{id}` na documentação da API mostra os mesmos dados.

## Executar os testes localmente

Com uv, Python 3.13 e Node.js 24 instalados, rode os comandos na raiz do projeto:

```sh
uv --directory backend sync --locked --python 3.13
uv --directory backend run --locked ruff check .
uv --directory backend run --locked pytest
npm --prefix frontend ci
npm --prefix frontend run lint
npm --prefix frontend test
npm --prefix frontend run typecheck
npm --prefix frontend run build
```
