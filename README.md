# Mars Probes

Mars Probes é um simulador de sondas em Marte, com uma interface React e uma API REST em Python. Use o painel para lançar sondas, acompanhá-las no mapa e enviar sequências de movimento.

Cada sonda começa em `(0, 0)`, tem limites próprios e pode compartilhar uma célula com outras sondas. O SQLite preserva os dados entre reinícios do backend.

## Início rápido com Docker

**Pré-requisitos** · Git, Docker em execução e Docker Compose com o comando `docker compose`. As imagens já incluem Python 3.13 e Node.js 24.

```sh
git clone https://github.com/gamabarbara/mars-probes.git
cd mars-probes
docker compose up --build
```

- **Interface** · [localhost:5173](http://localhost:5173)
- **API interativa (Swagger UI)** · [localhost:8000/docs](http://localhost:8000/docs)

Para parar, pressione `Ctrl+C` e execute `docker compose down` na raiz do repositório. O volume `probe-data` guarda o banco em `/data/probes.sqlite3` e persiste após reinícios e após `docker compose down`. Use `docker compose down -v` somente se quiser apagar o banco do Compose e começar com uma lista vazia.

## Primeiro voo

1. Na interface, clique em **Launch probe**. Preencha **X limit** e **Y limit** com `2`, escolha **North** e clique em **Launch**.
2. Lance outra sonda com limites `(4, 3)` e direção **North**. Em um banco vazio, o mapa exibe `2` na origem e a lista mostra IDs distintos.
3. Selecione a primeira sonda e envie `MRM` pelo botão **Send commands**. Confira a posição `(1, 1)` e a direção **East**. A segunda sonda permanece na origem.
4. Envie `LMM` à primeira sonda. O terceiro comando ultrapassa a borda. A sequência inteira é rejeitada e a sonda permanece em `(1, 1)`, na direção **East**.
5. Se estiver usando Docker, execute `docker compose restart backend`, recarregue a página e selecione as sondas. Confira os mesmos IDs, posições, direções e limites.

A malha vai de `(0, 0)` aos limites definidos no lançamento, inclusive. Cada limite aceita um inteiro de `0` a `100`. Uma sequência aceita de 1 a 1000 comandos em maiúsculas, sem espaços.

| Comando | Ação |
| --- | --- |
| `L` | Gira 90° à esquerda. |
| `R` | Gira 90° à direita. |
| `M` | Avança uma célula na direção atual. |

## API REST

A API recebe e retorna JSON. Explore os esquemas e execute pedidos no [Swagger UI](http://localhost:8000/docs) com o backend em execução.

| Método e rota | Operação | Sucesso |
| --- | --- | --- |
| `POST /probes` | Lança uma sonda. No pedido, `x` e `y` são os limites da malha. | `201 Created` |
| `GET /probes` | Lista sondas com paginação e ordenação. | `200 OK` |
| `GET /probes/{id}` | Consulta a posição, a direção e os limites da sonda. | `200 OK` |
| `POST /probes/{id}/commands` | Executa uma sequência de comandos. | `200 OK` |

Com o backend em execução, lance uma sonda pelo terminal.

```sh
curl --fail-with-body http://localhost:8000/probes \
  -H 'Content-Type: application/json' \
  -d '{"x":2,"y":2,"direction":"NORTH"}'
```

Copie o `id` retornado e substitua `<id>` nos dois comandos. A consulta final retorna `x: 1`, `y: 1`, `direction: "EAST"` e os limites `max_x: 2` e `max_y: 2`.

```sh
curl --fail-with-body 'http://localhost:8000/probes/<id>/commands' \
  -H 'Content-Type: application/json' \
  -d '{"commands":"MRM"}'

curl --fail-with-body 'http://localhost:8000/probes/<id>'
```

Em caso de falha, use o campo `code` para identificar o erro. Por exemplo, `422 INVALID_INPUT` indica entrada inválida e `409 OUT_OF_BOUNDS` indica que um passo sairia da malha.

[Contrato completo da API, com paginação, ordenação e erros](projeto-sondas-em-marte.md#3-contrato-da-api)

## Desenvolvimento sem Docker

**Pré-requisitos** · Python 3.13, uv, Node.js 24 e npm. Execute os comandos a partir da raiz do clone.

Instale as dependências conforme os arquivos de lock do projeto.

```sh
uv --directory backend sync --locked --python 3.13
npm --prefix frontend ci
```

Inicie o backend em um terminal.

```sh
uv --directory backend run --locked uvicorn main:app --reload --port 8000
```

Inicie o frontend em outro terminal e abra [localhost:5173](http://localhost:5173).

```sh
npm --prefix frontend run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

O Vite encaminha as requisições a `/probes` para o backend. Se você mudar a porta da API, ajuste também o destino do proxy.

| Variável | Onde definir | Valor padrão no ambiente local |
| --- | --- | --- |
| `DATABASE_PATH` | Processo do backend | `probes.sqlite3` no diretório de trabalho. Com o comando acima, o arquivo fica em `backend/probes.sqlite3`. |
| `API_PROXY_TARGET` | Processo do Vite | `http://127.0.0.1:8000` |

Se a interface abrir mas falhar ao carregar sondas, confira se o [Swagger UI](http://localhost:8000/docs) abre e se o proxy aponta para o endereço da API. No Docker, use `docker compose ps` e `docker compose logs backend frontend` para conferir os serviços.

## Testes e verificações

Depois de instalar as dependências locais, execute na raiz do repositório.

**Backend** · Ruff verifica o código. Pytest cobre as regras de domínio, a API e a persistência com bancos SQLite temporários.

```sh
uv --directory backend run --locked ruff check .
uv --directory backend run --locked pytest
```

**Frontend** · ESLint verifica o código. Vitest e React Testing Library cobrem fluxos da interface com respostas simuladas da API. O build também verifica os tipos do TypeScript.

```sh
npm --prefix frontend run lint
npm --prefix frontend test
npm --prefix frontend run typecheck
npm --prefix frontend run build
```

Para verificar a integração entre interface, API e banco, execute o [primeiro voo](#primeiro-voo).

## Estrutura do projeto

| Caminho | Responsabilidade |
| --- | --- |
| [`frontend/src/`](frontend/src/) | Interface React em TypeScript, com mapa, lista e formulários. |
| [`backend/api/`](backend/api/) | Rotas FastAPI, validação HTTP e respostas de erro. |
| [`backend/probe_service.py`](backend/probe_service.py) | Casos de uso e limites das transações. |
| [`backend/domain.py`](backend/domain.py) | Regras de posição, direção e movimento, independentes da API e do banco. |
| [`backend/persistence/`](backend/persistence/) | Repositório, modelos e transações SQLite com SQLAlchemy. |
| [`compose.yaml`](compose.yaml) | Configuração dos serviços e do volume de dados. |

[Requisitos, decisões técnicas e desenho da arquitetura](projeto-sondas-em-marte.md)
