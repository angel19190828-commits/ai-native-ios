import { CapabilityAdapter } from './types';

export class CapabilityRegistry {
  private readonly adapters = new Map<string, CapabilityAdapter>();

  constructor(adapters: CapabilityAdapter[] = []) {
    adapters.forEach((adapter) => this.register(adapter));
  }

  register(adapter: CapabilityAdapter) {
    if (this.adapters.has(adapter.descriptor.id)) {
      throw new Error(`Capability already registered: ${adapter.descriptor.id}`);
    }
    this.adapters.set(adapter.descriptor.id, adapter);
  }

  require(capabilityId: string) {
    const adapter = this.adapters.get(capabilityId);
    if (!adapter) throw new Error(`Capability is not registered: ${capabilityId}`);
    return adapter;
  }

  descriptors() {
    return [...this.adapters.values()].map((adapter) => adapter.descriptor);
  }
}

