# Sistema de funcionários

## Fila de produção integrada

No painel, **Fila de produção** está disponível para todos os funcionários com
acesso ao painel. Cadastre a equipe que recebe as ordens com o cargo **Produção**
na tela de Permissões. Esse cargo recebe todas as ordens e pode iniciar, pausar
(com motivo), retomar e concluir a fabricação. Os demais cargos, inclusive
administradores, emitem solicitações e acompanham as próprias ordens.

Administradores também visualizam as solicitações de todos os setores e podem
excluí-las pelo botão **Excluir**, após confirmação. Somente o cargo `admin`
permite excluir; a permissão de gerenciar usuários não concede esse acesso.
A exclusão remove a ordem da fila e mantém no histórico seus dados, o autor e
a data da exclusão. Se a produção tiver atualizado a ordem, é necessário
atualizar a lista antes de confirmar novamente.

A integração reutiliza as telas da pasta `fila produção teste`, com o login e
servidor Node do Razor; não exige outro login nem iniciar o backend .NET.
As ordens e o histórico são persistidos em `DATA_PATH/fila-producao.json`, com
gravação atômica e backup `.bak`, e atualizados na tela a cada 15 segundos.
Inclua esse arquivo no backup do sistema. O banco da aplicação independente
não é importado automaticamente. Execute `node test-fila-producao.js` para
validar permissões, emissão e o ciclo de produção.

Projeto independente focado no painel interno, Admin, Logística, cotações,
permissões e cadastros.

## Executar pelo CMD

```cmd
cd funcionarios
npm install
npm start
```

Abra http://localhost:3001/ (ou http://localhost:3001/login.html).
A raiz direciona automaticamente para o login. A porta padrão dos funcionários
é `3001`; a do site de clientes é `3000`. Para usar outro endereço ou porta na
intranet, configure `HOST` e `PORT` no `.env` desta pasta.

O `npm start` nesta pasta inicia somente o sistema de funcionários. Na raiz do
repositório, `npm start` inicia o gateway dos dois sistemas, com o painel em
http://localhost:8080/funcionarios/.

O projeto usa sua própria pasta `data`. Alterações em usuários, fornecedores e
demais registros ficam somente neste projeto.

Configure `CLIENTES_URL` no `.env` caso queira que o link de retorno abra o
site institucional em outro domínio.

## Implantação recomendada

Para publicar o projeto completo, execute os comandos na raiz do repositório e
use o gateway descrito em `../README.md`. Ele mantém este módulo em uma porta
privada e encaminha `/funcionarios/*`, `/api/*` e `/vendor/*`.

Não copie `node_modules` de outro computador. No servidor, use o
`package-lock.json` deste módulo com `npm ci`. As variáveis portáveis estão
documentadas em `.env.example`.

Os diretórios `data` e `rede` precisam ser graváveis e persistentes. Copie-os
ao migrar dados existentes e faça backup deles antes de cada atualização.

O CRM atual fica em `data/crm.json`. Se houver clientes em uma versão antiga
que usava IndexedDB, faça a migração no mesmo endereço/porta e perfil do
navegador antigo antes do corte, ou exporte o JSON antigo e importe-o no
servidor. Um domínio novo não consegue acessar o IndexedDB da origem anterior.
