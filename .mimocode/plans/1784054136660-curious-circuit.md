# Plano de Redesign - Razor Indústria

## Visão Geral
Redesign completo do site Razor Indústria com estilo industrial elegante, fundo escuro e acento dourado. Reestruturação da área do colaborador e sistema de cotações com formulário avançado e preview de mensagem.

---

## 1. Identidade Visual

### Paleta de Cores
```
--bg-primary: #0A0A0A      (fundo principal)
--bg-secondary: #111214     (fundo seções alternadas)
--bg-card: #1A1C1F          (fundo cards/formulários)
--bg-steel: #252830         (fundo elementos internos)
--accent: #FFC03A           (dourado - botões, destaques)
--accent-hover: #ffbb28     (dourado hover)
--accent-glow: #684700      (brilho dourado sutil)
--text-primary: #F5F5F5     (texto principal)
--text-secondary: #C8CDD8   (texto secundário)
--text-muted: #8A8E97       (texto discreto)
--border: rgba(255,255,255,0.07) (bordas sutis)
```

### Tipografia
- **Display/Títulos**: Barlow Condensed (700, 900) - uppercase, tracking apertado
- **Corpo**: Barlow (300, 400, 500, 600)
- **Mono/Stats**: JetBrains Mono ou Barlow Condensed

### Elementos Visuais
- Grid sutil animado como fundo decorativo (hero)
- Bordas geométricas (hexágono no logo)
- Gradientes radiais dourados como ambient glow
- Sem border-radius (design angular/industrial)

---

## 2. Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `public/css/style.css` | Reescrever completamente |
| `public/index.html` | Reescrever com nova estrutura |
| `public/funcionario.html` | Reestruturar com novo design + funcionalidades |
| `public/login.html` | Atualizar visual |
| `public/permissoes.html` | Atualizar visual |
| `public/js/app.js` | Atualizar lógica do formulário com preview |
| `public/js/funcionario.js` | Expandir funcionalidades |

---

## 3.index.html - Estrutura do Site

### Navbar
- Logo com ícone hexagonal dourado + texto "Razor"
- Links: Produtos, Sobre, Cotação, Contato
- CTA "Solicitar Cotação" com fundo dourado
- Mobile: hamburger menu com overlay

### Hero
- Grid animado sutil no fundo
- Eyebrow: "Ribeirão Preto — SP"
- Título grande: "Segurança que **corta** o padrão"
- Descrição + 2 botões (primário dourado + outline)
- Stats posicionados: +9 anos, 100% nacional, 8 linhas

### Produtos
- Grid de cards com imagens reais
- Cards com overlay gradiente escuro
- Tag + nome + descrição (aparece no hover)
- Concertina ocupa 2 colunas (destaque)
- 7 produtos + "Outro"

### Sobre
- Layout 2 colunas: visual (pillars com stats) + texto
- Stats: 100% produção, 5 anos garantia, distribuição BR, 8+ linhas
- Lista de vantagens com bullets diamante

### Cotação (NOVO SISTEMA)
- Layout 2 colunas: intro features + formulário
- **Formulário avançado**:
  - Dados pessoais (nome, empresa, cidade)
  - **Seletor de produtos com checkboxes** (expande campos específicos)
  - Cada produto tem campos próprios (tipo, dimensões, metragem via range)
  - Informações gerais (aplicação, prazo)
  - **Preview da mensagem** em tempo real
  - Botão WhatsApp verde
- Produtos com campos específicos:
  - Concertina: tipo, diâmetro, metragem, instalação
  - Alambrado: altura, malha, fio, acabamento, metragem, postes
  - Rede Laminada: altura, metragem
  - Tela Soldada: fio, malha, altura, rendimento
  - Gradil: altura, módulo, metragem, postes
  - Lança: modelo, material, comprimento, espaçamento, metragem
  - Tela Artística: material, aplicação, medidas, quantidade
  - Outro: descrição livre

### Contato
- Cards de contato (WhatsApp, email, endereço, horário)
- Mapa do Google Maps embutido

### Footer
- Logo + descrição + botão WhatsApp
- Coluna Produtos
- Coluna Empresa
- Bottom: copyright

### WhatsApp Float
- Botão flutuante verde no canto inferior direito

---

## 4. funcionario.html - Área do Colaborador (Reestruturada)

### Header
- Navbar com logo + links (Início, Painel, Permissões, Sair)

### Abas (Tabs)
1. **Prazo de Produção** - Calculadora de prazos
2. **Conversor de Medidas** - Conversão mm/cm/m/km
3. **Materiais Mureta** - Cálculo de materiais
4. **Peso Malha/Bobina** - Cálculo de peso
5. **Biblioteca de Imagens** - Upload/gestão de imagens (permissão)

### Visual
- Painel escuro com cards de cada ferramenta
- Formulários com inputs estilizados
- Resultados em boxes com destaque dourado

---

## 5. login.html

- Fundo escuro total
- Card centralizado com borda sutil
- Logo + título "Área do Colaborador"
- Inputs estilizados + botão dourado
- Link "Voltar ao site"

---

## 6. permissoes.html

- Header com título + botão "Novo Usuário"
- Tabela estilizada com ações
- Modal de edição com checkboxes de permissão
- Visual escuro consistente

---

## 7. JavaScript

### app.js
- Menu mobile toggle
- Smooth scroll
- Scroll reveal (IntersectionObserver)
- **Sistema de cotação**:
  - Construção dinâmica do seletor de produtos
  - Toggle de campos específicos por produto
  - Sliders de metragem com valor exibido
  - Geração de preview da mensagem em tempo real
  - Envio via WhatsApp com mensagem formatada

### funcionario.js
- Cálculos de prazo de produção
- Conversor de medidas
- Cálculo de materiais mureta
- Cálculo de peso malha/bobina
- Biblioteca de imagens (CRUD com API)

---

## 8. Verificação

1. Abrir `index.html` no navegador e verificar:
   - Navbar fixa com backdrop blur
   - Hero com grid animado e stats
   - Cards de produtos com hover effects
   - Formulário de cotação com seletor de produtos
   - Preview da mensagem atualizando em tempo real
   - Envio WhatsApp funcionando
   - Mapa carregando
   - Responsivo em mobile

2. Verificar páginas internas:
   - `login.html` - visual escuro
   - `funcionario.html` - abas funcionando, cálculos ok
   - `permissoes.html` - tabela e modal

3. Testar responsividade em 320px, 768px, 1024px+
