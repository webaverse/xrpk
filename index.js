const {Readable} = require('stream');
const path = require('path');
const fs = require('fs');
// const http = require('http');
const https = require('https');
const {FormData, Blob} = require('formdata-node');
const {FormDataEncoder} = require('form-data-encoder');
const fetch = require('node-fetch');

const argname = process.argv[2] || '.';

(async () => {
  const stats = await new Promise((accept, reject) => {
    fs.lstat(argname, (err, stats) => {
      if (!err) {
        accept(stats);
      } else {
        reject(err);
      }
    });
  });
  if (stats.isFile()) {
    const rs = fs.createReadStream(argname);
    const req = https.request({
      method: 'POST',
      host: 'ipfs.webaverse.com',
      path: '/',
    }, res => {
      const bs = [];
      res.on('data', d => {
        bs.push(d);
      });
      res.on('end', () => {
        const b = Buffer.concat(bs);
        bs.length = 0;
        const s = b.toString('utf8');
        const j = JSON.parse(s);
        const {hash} = j;
        console.log(`https://ipfs.webaverse.com/ipfs/${hash}`);
        const basename = path.basename(argname);
        console.log(`https://ipfs.webaverse.com/${hash}/${basename}`);
      });
    });
    req.on('error', err => {
      throw err;
    });
    rs.pipe(req);
  } else {
    const formData = new FormData();
    formData.append(
      '',
      new Blob([], {
        type: 'application/x-directory',
      }),
      ''
    );
    const _recurse = async p => {
      await new Promise((accept, reject) => {
        fs.readdir(p, async (err, filenames) => {
          if (!err) {
            await Promise.all(filenames.map(async filename => {
              await new Promise((accept, reject) => {
                const fullpath = path.join(p, filename);
                fs.lstat(fullpath, (err, stats) => {
                  if (!err) {
                    if (stats.isFile()) {
                      fs.readFile(fullpath, (err, b) => {
                        if (!err) {
                          console.log('file', fullpath, b.byteLength);
                          const uint8Array = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
                          const blob = new Blob([uint8Array], {
                            type: 'application/octet-stream',
                          })
                          formData.append(fullpath, blob, fullpath);
                          accept();
                        } else {
                          reject(err);
                        }
                      });
                    } else {
                      console.log('directory', fullpath);
                      formData.append(
                        fullpath,
                        new Blob([], {
                          type: 'application/x-directory',
                        }),
                        fullpath
                      );
                      _recurse(fullpath)
                        .then(accept, reject);
                    }
                  } else {
                    reject(err);
                  }
                });
              });
            }));
            accept();
          } else {
            reject(err);
          }
        });
      });
    };
    await _recurse(argname);
    
    const encoder = new FormDataEncoder(formData)
    const uploadFilesRes = await fetch(`https://ipfs.webaverse.com/`, {
      method: 'POST',
      headers: encoder.headers,
      body: Readable.from(encoder)
    });
    const hashes = await uploadFilesRes.json();
    // console.log('got ok', uploadFilesRes.ok, uploadFilesRes.status, hashes);

    const rootDirectory = hashes.find(h => h.name === '');
    // console.log('got hashes', {rootDirectory, hashes});
    const rootDirectoryHash = rootDirectory.hash;
    console.log(`https://ipfs.webaverse.com/ipfs/${rootDirectoryHash}/`);
  }
})();

/* const isDirectoryName = fileName => /\/$/.test(fileName);
const uploadFiles = async files => {
  const fd = new FormData();
  const directoryMap = {};
  const metaverseFile = files.find(f => f.name === '.metaversefile');
  // console.log('got', metaverseFile);
  const metaverseJson = await (async () => {
    const s = await metaverseFile.data.text();
    const j = JSON.parse(s);
    return j;
  })();
  const {start_url} = metaverseJson;
  [
    // mainDirectoryName,
    '',
  ].forEach(p => {
    if (!directoryMap[p]) {
      // console.log('add missing main directory', [p]);
      fd.append(
        p,
        new Blob([], {
          type: 'application/x-directory',
        }),
        p
      );
    }
  });

  for (const file of files) {
    const {name} = file;
    const basename = name; // localFileNames[name];
    // console.log('append', basename, name);
    if (isDirectoryName(name)) {
      const p = name.replace(/\/+$/, '');
      console.log('append dir', p);
      fd.append(
        p,
        new Blob([], {
          type: 'application/x-directory',
        }),
        p
      );
      directoryMap[p] = true;
    } else {
      // console.log('append file', name);
      fd.append(name, file.data, basename);
    }
  }

  const uploadFilesRes = await fetch(storageHost, {
    method: 'POST',
    body: fd,
  });
  const hashes = await uploadFilesRes.json();

  const rootDirectory = hashes.find(h => h.name === '');
  console.log('got hashes', {rootDirectory, hashes});
  const rootDirectoryHash = rootDirectory.hash;
  return rootDirectoryHash;
}; */