/** Apply the immutable manifest order to controls; never rearrange accepted answers. */
export function pinnedOrder<T>(items: readonly T[], order: readonly string[], id: (item: T) => string): T[] {
  const byId=new Map(items.map(item=>[id(item),item]));
  if(byId.size!==items.length||new Set(order).size!==order.length||items.length!==order.length||order.some(key=>!byId.has(key)))
    throw new TypeError('Invalid pinned presentation order');
  return order.map(key=>byId.get(key)!);
}
