# Plataforma Razor

Este diretório é a unidade implantável do projeto. O gateway da raiz inicia os
dois módulos e publica tudo em uma única porta:

- `/` — site institucional de clientes;
- `/funcionarios/` — painel interno;
- `/api/*` e `/vendor/*` — serviços internos do painel;
- `/site-clientes` — retorno do painel ao site institucional.

Os módulos continuam independentes, mas não é necessário configurar caminhos
do computador, abrir duas portas publicamente ou copiar `node_modules`.

## Estrutura em 30 segundos

- `clientes/` contém o site público;
- `funcionarios/` contém o painel interno e os dados persistentes;
- `scripts/` contém instalação, testes, verificação e empacotamento;
- `gateway.js` inicia os dois módulos em um único endereço;
- `Dockerfile` e `compose.yaml` são usados somente na implantação com Docker.

As pastas `node_modules/` e `dist/` não são código do projeto. Elas são geradas
pelos comandos de instalação e empacotamento e, por isso, ficam fora do Git.
Os arquivos `.env` também são locais; use os respectivos `.env.example` como
modelo sem publicar configurações privadas.

## Requisitos

- Node.js 20 ou superior;
- npm com acesso ao registro durante a instalação;
- permissão de leitura no projeto;
- permissão de gravação em `funcionarios/data` e `funcionarios/rede`.

Todos os caminhos usados pela aplicação são relativos ao próprio projeto. Os
arquivos `.env` locais não entram no pacote de implantação.

## Executar sem Docker

Na raiz do projeto:

```sh
copy .env.example .env
npm run install:apps:production
npm test
npm start
```

No Linux, substitua o primeiro comando por:

```sh
cp .env.example .env
```

Depois, abra `http://servidor:8080`. A porta pode ser alterada em `.env`.
O processo iniciado por `npm start` gerencia os dois módulos e encerra ambos de
forma coordenada quando recebe `SIGTERM` ou `SIGINT`.

Com a plataforma em execução, valide as rotas públicas e a saúde dos dois
módulos:

```sh
npm run smoke
```

Em uma cópia de homologação, `npm run smoke:crm` também valida autenticação,
gravação, atualização, deduplicação e exclusão no CRM. Esse teste cria registros
temporários e os remove ao terminar; não o execute durante manutenção dos dados.

Em produção, mantenha esse processo com systemd, Docker Compose ou outro
supervisor. Publique apenas a porta do gateway; as portas 3000 e 3001 são
internas.

## Executar com Docker Compose

```sh
cp .env.example .env
docker compose up -d --build
docker compose ps
```

O Compose cria volumes persistentes para os registros JSON e para as imagens
enviadas. Para atualizar:

```sh
docker compose build
docker compose up -d
```

Não remova os volumes durante uma atualização. Faça backup antes de usar
`docker compose down -v`, pois a opção `-v` apaga os dados persistentes.

## Criar um pacote limpo

```sh
npm run verify
npm run bundle
```

O pacote é criado em `dist/razor-deploy`. Ele contém um `MANIFEST.json` com
tamanho e SHA-256 de cada arquivo e exclui automaticamente:

- `.git`, caches e arquivos das ferramentas locais;
- todos os diretórios `node_modules`;
- arquivos `.env`;
- backups e versões legadas;
- pacotes gerados anteriormente.

Copie a pasta `dist/razor-deploy` para o servidor, crie o `.env` a partir do
exemplo e execute a instalação limpa. Não transporte `node_modules` do Windows
para Linux.

## Dados que precisam ser migrados e preservados

O painel grava dados em arquivos locais. Estes dois diretórios fazem parte do
estado persistente da aplicação:

```text
funcionarios/data
funcionarios/rede
```

Ao migrar um ambiente já utilizado, copie ambos com o serviço parado. No
servidor, o usuário do processo precisa ter permissão de gravação. Use apenas
uma instância do painel por conjunto de arquivos: gravações JSON e sessões não
são coordenadas entre múltiplos processos.

Em hospedagens com disco efêmero, configure um volume persistente. Caso
contrário, registros e imagens serão perdidos após uma recriação da instância.

### Migração do CRM que estava no navegador

Versões anteriores guardavam o CRM no IndexedDB de cada navegador. Esse banco é
isolado por protocolo, domínio, porta e perfil, portanto o domínio novo do
servidor não consegue lê-lo diretamente.

Antes de desligar o ambiente antigo, escolha uma destas formas:

1. execute esta versão atualizada no mesmo endereço e porta usados antes, entre
   no painel em cada perfil de navegador que possua clientes e confirme a cópia
   para o CRM central; depois copie `funcionarios/data` para o servidor; ou
2. use **Exportar** no CRM antigo, guarde o JSON, publique o servidor e use
   **Importar** no CRM novo.

Confira a quantidade de clientes no servidor antes de remover o ambiente
antigo. A migração não apaga o IndexedDB original, evita IDs já copiados,
preserva as datas disponíveis e move telefones legados inválidos para as
observações, mantendo o campo de telefone sujeito à validação atual.

## Configuração

Variáveis do gateway:

| Variável | Padrão | Uso |
| --- | --- | --- |
| `PORT` | `8080` | Porta pública única |
| `HOST` | `0.0.0.0` | Interface pública do gateway |
| `CLIENTES_INTERNAL_PORT` | `3000` | Porta privada do site |
| `FUNCIONARIOS_INTERNAL_PORT` | `3001` | Porta privada do painel |
| `CLIENTES_URL` | `/` | Retorno do painel ao site |
| `FUNCIONARIOS_URL` | `/funcionarios/` | Entrada do painel |
| `PROXY_TIMEOUT_MS` | `30000` | Limite de uma requisição ao módulo |
| `STARTUP_TIMEOUT_MS` | `20000` | Tempo para os módulos iniciarem |
| `HEALTH_TIMEOUT_MS` | `3000` | Limite da verificação de saúde de cada módulo |

As três portas precisam ser diferentes quando os módulos rodam no mesmo
servidor. Em plataformas que fornecem `PORT` automaticamente, mantenha as
portas internas nos valores padrão.

## Domínio e HTTPS

O gateway aceita uma única origem e evita a configuração frágil de subpastas em
dois servidores separados. Aponte Nginx, Caddy, Traefik ou o proxy da hospedagem
para a porta pública do gateway. O HTTPS deve terminar nesse proxy.

Os caminhos `/funcionarios/*`, `/api/*`, `/vendor/*` e `/site-clientes` já são
resolvidos pelo gateway. Não crie regras adicionais que removam esses caminhos.

## Verificações antes de publicar

```sh
npm run verify
npm test
```

A verificação confere:

- versão mínima do Node;
- presença de todos os arquivos essenciais;
- consistência entre `package.json` e `package-lock.json`;
- JSONs de dados válidos;
- referências locais e diferenças de maiúsculas/minúsculas que falhariam no
  Linux;
- ausência de caminhos absolutos do computador no código implantável.

## Serviços externos

O núcleo da aplicação e os arquivos de PDF são servidos localmente. Algumas
partes visuais ou integrações continuam dependendo da internet: Google Fonts,
Google Maps, Power BI, Nominatim, WhatsApp e bibliotecas visuais do JSDelivr.
Uma indisponibilidade desses serviços não cria vínculo com o computador de
desenvolvimento, mas pode reduzir recursos do site público.

Para uma instalação totalmente offline, essas bibliotecas e fontes precisam
ser hospedadas localmente, e integrações como mapas, Power BI, geocodificação e
WhatsApp precisam ser removidas ou substituídas.

## Segurança operacional

- Não publique arquivos `.env`.
- Proteja backups de `funcionarios/data`; eles contêm dados operacionais e
  credenciais da aplicação.
- Restrinja o painel interno no firewall ou proxy quando ele não for destinado
  à internet pública.
- Faça backups frequentes dos dois diretórios persistentes.
