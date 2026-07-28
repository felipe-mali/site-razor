# Sistema de funcionários

Projeto independente focado no painel interno, Admin, Logística, cotações,
permissões e cadastros.

## Executar pelo CMD

```cmd
cd funcionarios
npm install
npm start
```

Abra no endereço e na porta configurados pela sua intranet. A raiz direciona
automaticamente para o login.

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
