// polyfills required by undici when running on older Node versions
const { ReadableStream } = require('stream/web');
const { Blob } = require('buffer');

class File extends Blob {
  constructor(parts, name, options = {}) {
    super(parts, options);
    this.name = name;
    this.lastModified = options.lastModified || Date.now();
  }
}

class SimpleDOMException extends Error {
  constructor(message = '', name = 'DOMException') {
    super(message);
    this.name = name;
  }
}

if (typeof global.ReadableStream === 'undefined') {
  global.ReadableStream = ReadableStream;
}
if (typeof global.Blob === 'undefined') {
  global.Blob = Blob;
}
if (typeof global.File === 'undefined') {
  global.File = File;
}
if (typeof global.DOMException === 'undefined') {
  global.DOMException = SimpleDOMException;
}
