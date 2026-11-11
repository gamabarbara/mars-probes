# Mars Probes

## Executar com Docker Compose

Com Docker e Docker Compose instalados, execute na pasta deste projeto:

```sh
docker compose up --build
```

- React em [localhost:5173](http://localhost:5173).
- Documentação do FastAPI em [localhost:8000/docs](http://localhost:8000/docs).

As imagens usam Python 3.13 e Node.js 24. O volume `probe-data` monta `/data` no backend e reserva `/data/probes.sqlite3` para a entrega de lançamento.

Para parar os serviços, use `docker compose down`.
