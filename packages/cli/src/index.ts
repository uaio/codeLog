// @codelog/cli — CLI entry point
// Actual CLI logic lives in bin/codelog.js
// This module re-exports for programmatic use
export { start } from '@codelog/server/cli';
export { init } from '@codelog/server/cli/init';
