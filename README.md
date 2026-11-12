# Mars Probes

## Executar com Docker Compose

Com Docker e Docker Compose instalados, execute na pasta deste projeto:

```sh
docker compose up --build
```

- React em [localhost:5173](http://localhost:5173).
- Documentação do FastAPI em [localhost:8000/docs](http://localhost:8000/docs).

As imagens usam Python 3.13 e Node.js 24. Abra o React, informe os limites da malha e a direção inicial e clique em **Lançar**. A API grava a sonda em `/data/probes.sqlite3` no volume `probe-data`.

Para parar os serviços, use `docker compose down`.

## Executar os testes localmente

Com uv, Python 3.13 e Node.js 24 instalados, rode os comandos na raiz do projeto:

```sh
uv --directory backend sync --locked --python 3.13
uv --directory backend run --locked pytest
npm --prefix frontend ci
npm --prefix frontend test
```
