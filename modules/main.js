// Module entry point for the GZND app.
//
// Loads the 8 "core" modules eagerly (same set business.js/admin-data.js/
// sync.js/utilities-core.js/utilities-sales.js/utilities-payments.js/
// customers.js/constants.js used to be concatenated into in build.js), and
// lazy-loads factory.js / rep-sales.js on first use via real dynamic
// import() — this works identically in dev (served as-is) and in the built
// bundle (esbuild --splitting shares any modules factory.js/rep-sales.js
// import from the core set instead of duplicating them, so there's still
// only ever one instance of things like SQLiteCrypto's session key).
import './constants.js';
import './business.js';
import './admin-data.js';
import './sync.js';
import './utilities-core.js';
import './utilities-sales.js';
import './utilities-payments.js';
import './customers.js';

let _factoryLoad = null;
let _repLoad = null;

// Same callback-style contract utilities-sales.js already expects
// (`if (typeof window._lazyLoadFactory === 'function') window._lazyLoadFactory(resolve)`),
// so no changes are needed at the call sites.
window._lazyLoadFactory = function (cb) {
  if (!_factoryLoad) _factoryLoad = import('./factory.js');
  _factoryLoad.then(() => cb && cb()).catch(() => cb && cb());
};
window._lazyLoadRep = function (cb) {
  if (!_repLoad) _repLoad = import('./rep-sales.js');
  _repLoad.then(() => cb && cb()).catch(() => cb && cb());
};

import './custom-date-picker.js';
