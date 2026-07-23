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
