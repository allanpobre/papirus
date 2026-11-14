/**
 * Guarda o resultado de uma conta enquanto os dados de entrada forem os mesmos objetos (mesmo array, por identidade).
 * O universo é imutável: mexer numa ficha troca só o array das fichas, então as contas do manuscrito
 * (quem aparece, onde) continuam valendo e várias telas dividem o mesmo resultado. Some sozinho com os dados (WeakMap).
 * O resultado guardado é compartilhado: quem recebe não deve alterá-lo.
 */
export type IdentityCache = WeakMap<object, unknown>

export const identityCache = (): IdentityCache => new WeakMap()

export function cachedBy<R>(cache: IdentityCache, keys: readonly object[], compute: () => R): R {
  let node: IdentityCache = cache
  for (let i = 0; i < keys.length - 1; i++) {
    let next = node.get(keys[i]) as IdentityCache | undefined
    if (!next) {
      next = new WeakMap()
      node.set(keys[i], next)
    }
    node = next
  }
  const last = keys[keys.length - 1]
  if (node.has(last)) return node.get(last) as R
  const value = compute()
  node.set(last, value)
  return value
}
