'use strict';

window.MathJax = {
  loader: { load: ['[tex]/ams'] },
  chtml: {
    scale: 1,
    matchFontHeight: false
  },
  tex: {
    packages: { '[+]': ['ams'] }
  },
  options: {
    renderActions: {
      addMenu: []
    }
  }
};
