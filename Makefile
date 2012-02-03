
test:
	NODE_PATH=$(NODE_PATH):$(CURDIR)/lib $(CURDIR)/node_modules/vows/bin/vows test/*.test.js -v --spec

mocha:
	NODE_PATH=$(NODE_PATH):$(CURDIR)/lib $(CURDIR)/node_modules/mocha/bin/mocha -R spec test/*.mocha.js

.PHONY: test
