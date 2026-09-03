/**
 * Lumina — group.ts
 * Group / VGroup / VDict: mobjects whose geometry is the union of children.
 */
import { Mobject } from './mobject';
import { VMobject } from './vmobject';

export class Group extends Mobject {
  isGroup = true;
  constructor(...mobs: Mobject[]) {
    super();
    if (mobs.length === 1 && Array.isArray(mobs[0])) this.add(...(mobs[0] as Mobject[]));
    else this.add(...mobs);
  }
}

export class VGroup extends VMobject {
  isGroup = true;
  constructor(...mobs: (Mobject | Mobject[])[]) {
    super();
    const flat = mobs.flatMap((m) => (Array.isArray(m) ? m : [m]));
    this.add(...(flat as Mobject[]));
  }

  copy(): this {
    return super.copy() as this;
  }
}

/** VGroup with string-keyed access (doc 02 VDict). */
export class VDict extends VGroup {
  private keyMap = new Map<string, Mobject>();

  constructor(entries?: Array<[string, Mobject]> | Record<string, Mobject>) {
    super();
    if (entries) {
      if (Array.isArray(entries)) {
        for (const [k, m] of entries) this.addKey(k, m);
      } else {
        for (const [k, m] of Object.entries(entries)) this.addKey(k, m);
      }
    }
  }

  addKey(key: string, mob: Mobject): this {
    this.keyMap.set(key, mob);
    this.add(mob);
    return this;
  }

  get(key: string): Mobject | undefined {
    return this.keyMap.get(key);
  }

  removeKey(key: string): this {
    const m = this.keyMap.get(key);
    if (m) {
      this.remove(m);
      this.keyMap.delete(key);
    }
    return this;
  }

  keys(): string[] {
    return [...this.keyMap.keys()];
  }
}
