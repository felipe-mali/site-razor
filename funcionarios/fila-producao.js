'use strict';

const path = require('node:path');
const producao = user => String(user.cargo || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === 'producao';
const hoje = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date());

module.exports = function registrarFila(app, { authenticate, DATA_PATH, lerJson, escreverJsonAtomico, usuarioAtual }) {
  const arquivo = path.join(DATA_PATH, 'fila-producao.json');
  const ler = () => lerJson(arquivo, { proximoId: 1, ordens: [], historico: [] });
  const dto = ordem => ({ ...ordem, atrasada: !['concluida', 'cancelada'].includes(ordem.status) && ordem.prazo < hoje() });
  app.use('/api/fila-producao', authenticate, (req, res, next) => {
    const atual = usuarioAtual(req.user.usuario);
    if (!atual || atual.ativo === false || !atual.pode_ver_funcionario) return res.status(403).json({ error: 'Acesso ao painel não autorizado.' });
    req.user = { ...atual, usuario: req.user.usuario };
    next();
  });
  app.get('/api/fila-producao/sessao', (req, res) => res.json({ nome: req.user.nome, setor: producao(req.user) ? 'Producao' : req.user.cargo, podeExcluir: req.user.cargo === 'admin' }));
  app.get('/api/fila-producao/ordens', (req, res) => {
    const encerrada = o => ['concluida', 'cancelada'].includes(o.status);
    res.json(ler().ordens.filter(o => producao(req.user) || req.user.cargo === 'admin' || o.solicitanteId === req.user.usuario)
      .sort((a, b) => Number(encerrada(a)) - Number(encerrada(b)) || Number(b.prioridade === 'urgente') - Number(a.prioridade === 'urgente') || a.id - b.id).map(dto));
  });
  app.post('/api/fila-producao/ordens', (req, res) => {
    if (producao(req.user)) return res.status(403).json({ error: 'A produção recebe as ordens. A emissão pertence aos demais setores.' });
    const entrada = req.body || {};
    const limites = { produto: 160, medida: 120, cor: 80, cliente: 160, observacoes: 2000 };
    const dados = {};
    for (const [campo, limite] of Object.entries(limites)) {
      const valor = entrada[campo] ?? '';
      if (typeof valor !== 'string' || valor.length > limite) return res.status(400).json({ error: `Campo ${campo} inválido (máximo ${limite} caracteres).` });
      dados[campo] = valor.trim();
    }
    const q = entrada.quantidade;
    const prazo = entrada.prazo;
    const data = typeof prazo === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(prazo) ? new Date(`${prazo}T12:00:00Z`) : null;
    if (!dados.produto || typeof q !== 'number' || !Number.isFinite(q) || q < 0.001 || q > 999999999.999 || Math.abs(q * 1000 - Math.round(q * 1000)) > 0.0001 || !['un', 'm', 'm²', 'kg', 'pc'].includes(entrada.unidade) || !['normal', 'urgente'].includes(entrada.prioridade) || !data || !Number.isFinite(data.getTime()) || data.toISOString().slice(0, 10) !== prazo || prazo < hoje()) return res.status(400).json({ error: 'Confira produto, quantidade (até 3 decimais), unidade, prioridade e prazo a partir de hoje.' });
    const banco = ler();
    const id = banco.proximoId++;
    const ordem = { ...dados, id, numeroOP: `OP-${String(id).padStart(6, '0')}`, quantidade: q, unidade: entrada.unidade, prazo, prioridade: entrada.prioridade, solicitanteId: req.user.usuario, solicitante: req.user.nome, setorSolicitante: req.user.cargo, status: 'aguardando', versao: 1, dataSolicitacao: new Date().toISOString(), dataInicio: null, dataFinalizacao: null, responsavel: null };
    banco.ordens.push(ordem);
    banco.historico.push({ ordemId: id, usuario: req.user.usuario, acao: 'criar', statusNovo: ordem.status, data: ordem.dataSolicitacao });
    escreverJsonAtomico(arquivo, banco);
    res.status(201).json(dto(ordem));
  });
  app.delete('/api/fila-producao/ordens/:id', (req, res) => {
    if (req.user.cargo !== 'admin') return res.status(403).json({ error: 'Somente administradores podem excluir solicitações.' });
    const banco = ler();
    const indice = banco.ordens.findIndex(o => o.id === Number(req.params.id));
    if (indice < 0) return res.status(404).json({ error: 'Solicitação não encontrada. Atualize a lista.' });
    const ordem = banco.ordens[indice];
    if (req.body?.versao !== ordem.versao) return res.status(409).json({ error: 'A solicitação foi atualizada. Atualize a lista e confira os dados antes de excluir.' });
    banco.ordens.splice(indice, 1);
    banco.historico.push({ ordemId: ordem.id, usuario: req.user.usuario, acao: 'excluir', data: new Date().toISOString(), ordem });
    escreverJsonAtomico(arquivo, banco);
    res.json({ success: true, numeroOP: ordem.numeroOP });
  });
  app.post('/api/fila-producao/ordens/:id/:acao', (req, res) => {
    if (!producao(req.user)) return res.status(403).json({ error: 'Somente a produção pode atualizar a fila.' });
    const banco = ler();
    const ordem = banco.ordens.find(o => o.id === Number(req.params.id));
    if (!ordem) return res.status(404).json({ error: 'Ordem não encontrada.' });
    const entrada = req.body || {};
    const acao = req.params.acao;
    const transicoes = { iniciar: ['aguardando', 'producao'], pausar: ['producao', 'pausada'], retomar: ['pausada', 'producao'], finalizar: ['producao', 'concluida'] };
    const transicao = Object.hasOwn(transicoes, acao) && transicoes[acao];
    if (!transicao || ordem.status !== transicao[0] || entrada.versao !== ordem.versao) return res.status(409).json({ error: 'A ordem mudou ou não permite esta ação. Atualize a fila.' });
    if (acao === 'pausar' && (!['Falta de material', 'Manutenção', 'Ajuste de máquina', 'Prioridade alterada', 'Intervalo', 'Outro'].includes(entrada.motivoPausa) || (entrada.observacaoPausa != null && (typeof entrada.observacaoPausa !== 'string' || entrada.observacaoPausa.length > 2000)))) return res.status(400).json({ error: 'Informe um motivo válido e observação de até 2000 caracteres.' });
    const agora = new Date().toISOString();
    const anterior = ordem.status;
    ordem.status = transicao[1];
    ordem.versao++;
    if (acao === 'iniciar') { ordem.dataInicio = agora; ordem.responsavel = req.user.nome; }
    if (acao === 'pausar') { ordem.motivoPausa = entrada.motivoPausa; ordem.observacaoPausa = (entrada.observacaoPausa || '').trim(); }
    if (acao === 'finalizar') ordem.dataFinalizacao = agora;
    banco.historico.push({ ordemId: ordem.id, usuario: req.user.usuario, acao, statusAnterior: anterior, statusNovo: ordem.status, data: agora, motivo: acao === 'pausar' ? ordem.motivoPausa : null, observacao: acao === 'pausar' ? ordem.observacaoPausa : null });
    escreverJsonAtomico(arquivo, banco);
    res.json(dto(ordem));
  });
};
