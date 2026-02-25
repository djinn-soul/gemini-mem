#!/usr/bin/env node
process.stderr.write("intentional failure for fail-open test\n");
process.exit(17);
