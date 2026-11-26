import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAssetUrl } from './assetPath';

test('resolveAssetUrl preserves external, data, and blob URLs unchanged', () => {
  assert.equal(
    resolveAssetUrl('https://cryptologos.cc/logos/bitcoin-btc-logo.png', './'),
    'https://cryptologos.cc/logos/bitcoin-btc-logo.png'
  );
  assert.equal(resolveAssetUrl('data:image/png;base64,abc', './'), 'data:image/png;base64,abc');
  assert.equal(resolveAssetUrl('blob:https://example.com/123', './'), 'blob:https://example.com/123');
});

test('resolveAssetUrl resolves local assets cleanly with relative ./ base for GitHub Pages', () => {
  assert.equal(
    resolveAssetUrl('/assets/aistudio/aviator_ouroboros.html', './'),
    './assets/aistudio/aviator_ouroboros.html'
  );
  assert.equal(
    resolveAssetUrl('assets/logos/samsung.svg', './'),
    './assets/logos/samsung.svg'
  );
  assert.equal(
    resolveAssetUrl('./assets/ouroboros-logo.png', './'),
    './assets/ouroboros-logo.png'
  );
  assert.equal(
    resolveAssetUrl('assets/ouroboros-emblem.png', '/ouroboros-repo/'),
    '/ouroboros-repo/assets/ouroboros-emblem.png'
  );
});
