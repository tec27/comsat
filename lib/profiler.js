function Profiler(name) {
  this.name = name;
  this.start = new Date();
}
Profiler.prototype.done = function() {
  console.log('\t\033[30;1m%s\033[0m  \033[36m%dms\033[0m', this.name, (new Date() - this.start));
}

module.exports.Profiler = Profiler;
