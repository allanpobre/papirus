import { z } from 'zod'

/** Versão atual do formato salvo. Toda mudança de formato exige uma migração em `migrations.ts`. */
export const CURRENT_SCHEMA_VERSION = 1

/**
 * Documento de uma cena no formato JSON do editor (ProseMirror/TipTap).
 * Validamos apenas a forma mínima; o conteúdo interno pertence ao editor.
 */
export const sceneDocSchema = z.looseObject({
  type: z.literal('doc'),
  content: z.array(z.looseObject({ type: z.string() })).optional(),
})

export const storySchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const sceneSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  /** `null` = cena solta, sem história. */
  storyId: z.string().min(1).nullable(),
  /** Ordem dentro da história (ou entre as cenas soltas). */
  order: z.number(),
  doc: sceneDocSchema,
  /** Projeção em texto puro do documento, usada em busca e detecção. */
  text: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const universeSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  stories: z.array(storySchema),
  scenes: z.array(sceneSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const savedFileSchema = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  /** Incrementa a cada salvamento; base para controle de revisão. */
  revision: z.number().int().nonnegative(),
  universe: universeSchema,
})

export type SceneDoc = z.infer<typeof sceneDocSchema>
export type Story = z.infer<typeof storySchema>
export type Scene = z.infer<typeof sceneSchema>
export type Universe = z.infer<typeof universeSchema>
export type SavedFile = z.infer<typeof savedFileSchema>
