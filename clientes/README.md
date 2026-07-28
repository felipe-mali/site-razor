# Clientes

Projeto independente com o site institucional voltado aos clientes.

## Executar pelo CMD

```cmd
cd clientes
npm install
npm start
```

Abra no endereço e na porta configurados pela sua intranet.

Configure `FUNCIONARIOS_URL` no `.env` com o endereço público do sistema
interno. O valor padrão `/funcionarios/` funciona quando ambos são publicados
no mesmo domínio por um proxy reverso.

## Implantação recomendada

Para publicar o projeto completo, execute os comandos na raiz do repositório e
use o gateway descrito em `../README.md`. Ele inicia este módulo em uma porta
privada e publica o acesso ao painel em `/funcionarios/`.

Não copie `node_modules` de outro computador. No servidor, use o
`package-lock.json` deste módulo com `npm ci`. As variáveis portáveis estão
documentadas em `.env.example`.
