/**
 * Nơi lưu gói két ĐÃ MÃ HOÁ (ngoài chuỗi). Trên chuỗi chỉ có `uri` + SHA-256 của gói.
 * Chọn nơi XOÁ ĐƯỢC (IPFS + pin): A xoá két → bỏ pin.
 */
export interface BlobStore {
  put(bytes: Uint8Array): Promise<string>;
  get(uri: string): Promise<Uint8Array>;
  remove(uri: string): Promise<void>;
}

const cidOf = (uri: string) => {
  if (!uri.startsWith('ipfs://')) throw new Error(`URI không phải IPFS: ${uri}`);
  return uri.slice('ipfs://'.length);
};

/** Node IPFS (Kubo) qua HTTP API — tự chạy hoặc của nhà cung cấp pinning tương thích. */
export class KuboStore implements BlobStore {
  constructor(private apiUrl: string, private gatewayUrl: string) {}

  async put(bytes: Uint8Array): Promise<string> {
    const form = new FormData();
    form.append('file', new Blob([bytes as BlobPart]), 'vault.json');
    const res = await fetch(`${this.apiUrl}/api/v0/add?pin=true&cid-version=1`, { method: 'POST', body: form });
    if (!res.ok) throw new Error(`Không tải được lên IPFS (${res.status})`);
    const { Hash } = (await res.json()) as { Hash: string };
    return `ipfs://${Hash}`;
  }

  async get(uri: string): Promise<Uint8Array> {
    const res = await fetch(`${this.gatewayUrl}/ipfs/${cidOf(uri)}`);
    if (!res.ok) throw new Error(`Không tải được gói két (${res.status})`);
    return new Uint8Array(await res.arrayBuffer());
  }

  async remove(uri: string): Promise<void> {
    const res = await fetch(`${this.apiUrl}/api/v0/pin/rm?arg=${cidOf(uri)}`, { method: 'POST' });
    // Đã bỏ pin trước đó thì coi như xong.
    if (!res.ok && res.status !== 500) throw new Error(`Không bỏ pin được (${res.status})`);
  }
}

/** Bộ nhớ trong — cho kiểm thử. */
export class MemoryStore implements BlobStore {
  private blobs = new Map<string, Uint8Array>();
  private n = 0;
  async put(bytes: Uint8Array) {
    const uri = `ipfs://mem-${++this.n}`;
    this.blobs.set(uri, bytes);
    return uri;
  }
  async get(uri: string) {
    const b = this.blobs.get(uri);
    if (!b) throw new Error('Không tìm thấy');
    return b;
  }
  async remove(uri: string) {
    this.blobs.delete(uri);
  }
}
