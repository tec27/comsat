
test:
	NODE_PATH=$(NODE_PATH):$(CURDIR)/lib $(CURDIR)/node_modules/vows/bin/vows test/*.test.js -v --spec

.PHONY: test
