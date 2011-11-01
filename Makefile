
test:
	NODE_PATH=$(NODE_PATH):$(CURDIR)/lib expresso -c test/*.test.js

cov:
	node-jscoverage lib lib-cov; NODE_PATH=$(NODE_PATH):$(CURDIR)/lib-cov expresso -c test/*.test.js; rm -rf lib-cov

.PHONY: test cov
