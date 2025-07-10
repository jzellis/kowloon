export default class StorageAdapter {
  async upload(buffer, options) {
    throw new Error("upload() not implemented");
  }

  async delete(fileUrl) {
    throw new Error("delete() not implemented");
  }
}
