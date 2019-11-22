/* global jQuery: false, window: false, document: false, chrome: false */

const RW = (function() {
  // const info = chrome.runtime.getManifest();
  const notifier = jQuery({});
  const panel = jQuery('#panel');
  const busca = jQuery('#busca');
  const requiredParameters = {
    all: ['v', 't', 'cid', 'tid'],
    social: ['sn', 'sa', 'st'],
    transaction: ['ti'],
    item: ['ti', 'in']
  };
  const modules = {
    universal_analytics: {
      template: jQuery(jQuery('#template-universal').html()),
      parseByType(type, params) {
        if (!requiredParameters[type]) return [];

        return requiredParameters[type].filter(
          param => params[param] === undefined
        );
      },
      appendNewHit(obj) {
        const clone = this.template.clone();
        const content = decode(obj.content);
        clone.addClass(obj.parameters.t).data('qs', obj.queryString);
        clone.find('.label').addClass(obj.status);
        clone
          .find('.content')
          .attr('title', content)
          .text(content);
        clone.find('table.queryString').html(objectToRows(obj.parameters));
        panel.append(clone);
        if (RW.autoscroll) clone.get(0).scrollIntoView({ behavior: 'smooth' });
      },
      handler(params) {
        let content = '';

        switch (params.t) {
          case 'pageview':
            if (params.dp) {
              content = (params.dh || '') + params.dp;
            } else {
              content = params.dl;
            }
            // color = "#3333CC";
            break;
          case 'event':
            content = [params.ec, params.ea, params.el]
              .map(val => val || '<empty>')
              .join(' > ');
            // color = "#33CC33";
            break;
          case 'transaction':
            content = `Trans: ${params.ti} > ${params.tr}`;
            // color = "#CC33CC";
            break;
          case 'item':
            content = `${params.iv} > ${params.in}`;
            // color = "#CC3380";
            break;
          case 'screenview':
            content = params.cd;
            // color = "#CC3380";
            break;
          case 'social':
            content = `${params.sn} > ${params.sa}`;
            // color = "#33CCCC";
            break;
          case 'timing':
            content = [params.utc, params.utv, params.utl, params.utt].join(
              ' > '
            );
            // color = "#A66F00";
            break;
        }

        const errors = [
          ['all', params],
          [params.t, params]
        ]
          .map(this.parseByType)
          .filter(error => error.length > 0);

        this.appendNewHit({
          parameters: params,
          queryString: JSON.stringify(params),
          status: errors.length ? 'error' : 'ok',
          content
        });

        publish('newhit', params);

        if (panel.hasClass('filtrado') && !panel.hasClass(params.t)) {
          panel.find();
        }
      }
    }
  };

  function clear() {
    jQuery('.track').remove();
    busca.val('');
  }

  function publish(type, data) {
    notifier.trigger(type, data);
  }

  function subscribe(type, func) {
    notifier.on(type, func);
  }

  function queryToObject(url = '') {
    if (url.startsWith('?')) url = url.slice(1);

    return url.split('&').reduce((acc, next) => {
      const [key, ...val] = next.split('=');
      acc[key] = val.join('=');
      return acc;
    }, {});
  }

  function objectToQuery(obj) {
    return Object.keys(obj)
      .reduce((acc, key) => acc.concat(`${key}=${escape(obj[key])}`), [])
      .join('&');
  }

  function objectToRows(obj) {
    const metadata = window.metadata.universal_analytics;
    const html = Object.keys(obj)
      .filter(key => !key.startsWith('_'))
      .map(key => {
        const keyName = decode(metadata[key] ? metadata[key].name : key);
        const value = decode(obj[key]);
        return `<td class="key" title="${key}">${keyName}</td>
					<td class="value" title="${value}">${value}</td>`;
      });
    return html.length ? '<tr>' + html.join('</tr><tr>') + '</tr>' : '';
  }

  function decode(str) {
    try {
      return decodeURIComponent(str);
    } catch ($$e) {
      return unescape(str);
    }
  }

  function encode(str) {
    try {
      return encodeURIComponent(str);
    } catch ($$e) {
      return escape(str);
    }
  }
  function init(msg) {
    modules.universal_analytics.handler(msg);
  }

  return {
    init,
    busca,
    panel,
    clear,
    autoscroll: true,
    util: {
      queryToObject,
      objectToQuery,
      pub: publish,
      sub: subscribe
    }
  };
})();

socket.on('hit sent', msg => {
  console.log(msg);
  RW.init(msg);
});
