import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { findInDoc, type FindOptions } from './find'

export interface SearchQuery {
  query: string
  opts: FindOptions
  /** Qual achado está em foco (o "3 de 7"). */
  current: number
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    search: {
      /** Destaca no texto o que está sendo procurado (`null` apaga o destaque). */
      setSearch: (search: SearchQuery | null) => ReturnType
    }
  }
}

interface SearchState {
  search: SearchQuery | null
  decorations: DecorationSet
}

export const searchKey = new PluginKey<SearchState>('search')

/** Só visual, como a detecção de nomes: nada é salvo no texto. */
export const Search = Extension.create({
  name: 'search',

  addCommands() {
    return {
      setSearch:
        (search) =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(searchKey, search).setMeta('addToHistory', false))
          return true
        },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<SearchState>({
        key: searchKey,
        state: {
          init: (): SearchState => ({ search: null, decorations: DecorationSet.empty }),
          apply(tr, value, _old, state) {
            const meta = tr.getMeta(searchKey) as SearchQuery | null | undefined
            if (meta !== undefined) return { search: meta, decorations: decorate(state, meta) }
            if (!tr.docChanged || !value.search) return value
            return { search: value.search, decorations: decorate(state, value.search) }
          },
        },
        props: {
          decorations: (state) => searchKey.getState(state)?.decorations,
        },
      }),
    ]
  },
})

function decorate(state: EditorState, search: SearchQuery | null): DecorationSet {
  if (!search?.query) return DecorationSet.empty
  const hits = findInDoc(state.doc, search.query, search.opts)
  return DecorationSet.create(
    state.doc,
    hits.map((h, i) => Decoration.inline(h.from, h.to, { class: i === search.current ? 'search-hit is-current' : 'search-hit' })),
  )
}
