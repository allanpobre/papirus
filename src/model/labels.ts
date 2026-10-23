import type { Canon, Editorial, KnowledgeState, SceneStatus, SeedStatus, Session } from './schema'

export const KIND_LABEL: Record<string, string> = {
  personagem: 'Personagem',
  lugar: 'Lugar',
  faccao: 'Facção ou casa',
  cultura: 'Cultura',
  religiao: 'Religião',
  magia: 'Sistema de magia',
  artefato: 'Artefato',
  especie: 'Espécie',
  reino: 'Reino ou plano',
  conceito: 'Conceito',
}

export const KIND_PLURAL: Record<string, string> = {
  personagem: 'Personagens',
  lugar: 'Lugares',
  faccao: 'Facções e casas',
  cultura: 'Culturas',
  religiao: 'Religiões',
  magia: 'Magia',
  artefato: 'Artefatos',
  especie: 'Espécies',
  reino: 'Reinos e planos',
  conceito: 'Conceitos',
}

export const kindLabel = (kind: string) => KIND_LABEL[kind] ?? kind
export const kindPlural = (kind: string) => KIND_PLURAL[kind] ?? kind

export const CANON_LABEL: Record<Canon, string> = {
  estabelecido: 'Estabelecido',
  rumor: 'Rumor',
  lenda: 'Lenda',
  disputado: 'Disputado',
  secreto: 'Secreto',
  falso: 'Falso',
  desconhecido: 'Desconhecido',
}

export const CANON_HINT: Record<Canon, string> = {
  estabelecido: 'Verdade no universo',
  rumor: 'Circula, mas sem confirmação',
  lenda: 'Contada como lenda; pode ou não ser verdade',
  disputado: 'Fontes discordam',
  secreto: 'Verdade, mas escondida',
  falso: 'Mentira ou engano registrado',
  desconhecido: 'Nem o autor decidiu',
}

export const EDITORIAL_LABEL: Record<Editorial, string> = {
  rascunho: 'Rascunho',
  provisorio: 'Provisório',
  definido: 'Definido',
  'nao-decidido': 'Não decidido',
}

export const SCENE_STATUS_LABEL: Record<SceneStatus, string> = {
  ideia: 'Ideia',
  rascunho: 'Rascunho',
  revisao: 'Em revisão',
  pronta: 'Pronta',
}

export const SEED_STATUS_LABEL: Record<SeedStatus, string> = {
  aberta: 'Aberta',
  parcial: 'Parcial',
  resolvida: 'Resolvida',
  abandonada: 'Abandonada',
}

export const KNOWLEDGE_LABEL: Record<KnowledgeState, string> = {
  sabe: 'Sabe',
  suspeita: 'Suspeita',
  acredita: 'Acredita (sem ser verdade)',
  esqueceu: 'Esqueceu',
}

export const SESSION_STATUS_LABEL: Record<Session['status'], string> = {
  planejada: 'Planejada',
  'em-andamento': 'Em andamento',
  encerrada: 'Encerrada',
}

/** Formata um ano do calendário do universo. */
export function formatYear(year: number | null | undefined, suffix = ''): string {
  if (year === null || year === undefined) return ''
  return suffix ? `${year} ${suffix}` : String(year)
}
