#!/usr/bin/env node
import { main } from '../index.js';

main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error('Fatal error:', error.message);
    if (error.stack) console.error(error.stack);
  } else {
    console.error('Fatal error:', String(error));
  }
  process.exit(1);
});
