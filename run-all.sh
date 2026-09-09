#!/bin/bash
# Runs every suite. From this folder:  npm install jsdom && bash run-all.sh
# Each file boots the real index.html in jsdom and asserts against it.
for t in smoke sweep edit-test links roundup settings dash orders stest pv pics cards kb notify push-crypto product-links products-db; do
  printf '%-14s ' "$t"
  node "$t.js" 2>&1 | tail -1
done
