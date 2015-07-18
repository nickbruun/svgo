'use strict';

exports.type = 'full';

exports.active = true;

exports.description = 'dereferences definitions that only have a single use';

exports.params = {};

var referencesProps = require('./_collections').referencesProps,
    regReferencesUrl = /^url\(("|')?#(.+?)\1\)$/,
    regReferencesHref = /^#(.+?)$/,
    regReferencesBegin = /^(\w+?)\./,
    styleOrScript = ['style', 'script'];

/**
 * Dereference references that are only referenced by a single use node
 * (only if there are no any <style> or <script>).
 *
 * Adapted from Kir Belevich's cleanupIDs plugin.
 *
 * @param {Object} item current iteration item
 * @param {Object} params plugin params
 *
 * @author Nick Bruun
 */
exports.fn = function(data, params) {
    var defIDs = {},
        referencesIDs = {},
        hasStyleOrScript = false;

    /**
     * Scan items.
     *
     * @param {Array} items input items
     */
    function scanItems(items, parentIsDefs) {
        // Walk through all the items.
        for (var i = 0; i < items.content.length; i++) {
            var item = items.content[i],
                match;

            // If the item is a style or script element, flag and break.
            if (item.isElem(styleOrScript)) {
                hasStyleOrScript = true;
                return;
            }

            if (item.isElem()) {
                item.eachAttr(function(attr) {
                    // Save IDs if the parent node is a definition set.
                    if ((attr.name === 'id') && (parentIsDefs)) {
                        defIDs[attr.value] = item;
                    }

                    // Save IDs url() references.
                    else if (referencesProps.indexOf(attr.name) > -1) {
                        match = attr.value.match(regReferencesUrl);

                        if (match) {
                            if (referencesIDs[match[2]]) {
                                referencesIDs[match[2]].push(item);
                            } else {
                                referencesIDs[match[2]] = [item];
                            }
                        }
                    }

                    // Save IDs href references.
                    else if (((attr.name === 'xlink:href') &&
                              (match = attr.value.match(regReferencesHref))) ||
                             ((attr.name === 'begin') &&
                              (match = attr.value.match(regReferencesBegin)))) {
                        if (referencesIDs[match[1]]) {
                            referencesIDs[match[1]].push(item);
                        } else {
                            referencesIDs[match[1]] = [item];
                        }
                    }
                });
            }

            // Scan recursively.
            if (item.content) {
                scanItems(item, item.isElem('defs'));
            }
        }
    }

    // Scan the entire document.
    scanItems(data);

    // Don't do anything if we have style or script elements, as this could
    // mess things up serverelse.
    if (hasStyleOrScript)
        return data;

    for (var k in referencesIDs) {
        // Fetch the references and ensure there's only one, which is a use
        // reference.
        var defNode;
        if (!(defNode = defIDs[k]))
            continue;

        var referencesID = referencesIDs[k];
        if ((referencesID.length != 1) || (referencesID[0].elem != 'use'))
            continue;

        var useNode = referencesID[0];

        // Do not dereference the use element if it has a width or height
        // attribute.
        if ((useNode.attrs.width) || (useNode.attrs.height))
            continue;

        // Dereference by changing the use node to a group node and adding a
        // clone of the definition node as the content of the group node.
        var x = (useNode.attrs.x ? useNode.attrs.x.value : '0'),
            y = (useNode.attrs.y ? useNode.attrs.y.value : '0');

        useNode.removeAttr('x');
        useNode.removeAttr('y');
        useNode.removeAttr('xlink:href');
        useNode.renameElem('g');
        if ((x !== '0') || (y !== '0')) {
            useNode.addAttr({
                name: 'transform',
                local: 'transform',
                value: 'translate(' + x + ',' + y + ')',
                prefix: ''
            });
        }

        var derefedNode = defNode.clone();
        derefedNode.removeAttr('id');
        useNode.content = [derefedNode];
    }

    return data;
};
