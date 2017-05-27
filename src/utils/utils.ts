
export interface RaceResult<V> {
  timedOut: boolean;
  result?: V;
}

export class Utils {
  stopWords: string[] = "a,i,a’s, able, about, above, according, accordingly, across, actually, after, afterwards, again, against, ain’t, all, allow, allows, almost, alone, along, already, also, although, always, am, among, amongst, an, and, another, any, anybody, anyhow, anyone, anything, anyway, anyways, anywhere, apart, appear, appreciate, appropriate, are, aren’t, around, as, aside, ask, asking, associated, at, available, away, awfully, be, became, because, become, becomes, becoming, been, before, beforehand, behind, being, believe, below, beside, besides, best, better, between, beyond, both, brief, but, by, c’mon, c’s, came, can, can’t, cannot, cant, cause, causes, certain, certainly, changes, clearly, co, com, come, comes, concerning, consequently, consider, considering, contain, containing, contains, corresponding, could, couldn’t, course, currently, definitely, described, despite, did, didn’t, different, do, does, doesn’t, doing, don’t, done, down, downwards, during, each, edu, eg, eight, either, else, elsewhere, enough, entirely, especially, et, etc, even, ever, every, everybody, everyone, everything, everywhere, ex, exactly, example, except, far, few, fifth, first, five, followed, following, follows, for, former, formerly, forth, four, from, further, furthermore, get, gets, getting, given, gives, go, goes, going, gone, got, gotten, greetings, had, hadn’t, happens, hardly, has, hasn’t, have, haven’t, having, he, he’s, hello, help, hence, her, here, here’s, hereafter, hereby, herein, hereupon, hers, herself, hi, him, himself, his, hither, hopefully, how, howbeit, however, i’d, i’ll, i’m, i’ve, ie, if, ignored, immediate, in, inasmuch, inc, indeed, indicate, indicated, indicates, inner, insofar, instead, into, inward, is, isn’t, it, it’d, it’ll, it’s, its, itself, just, keep, keeps, kept, know, knows, known, last, lately, later, latter, latterly, least, less, lest, let, let’s, like, liked, likely, little, look, looking, looks, ltd, mainly, many, may, maybe, me, mean, meanwhile, merely, might, more, moreover, most, mostly, much, must, my, myself, name, namely, nd, near, nearly, necessary, need, needs, neither, never, nevertheless, new, next, nine, no, nobody, non, none, noone, nor, normally, not, nothing, novel, now, nowhere, obviously, of, off, often, oh, ok, okay, old, on, once, one, ones, only, onto, or, other, others, otherwise, ought, our, ours, ourselves, out, outside, over, overall, own, particular, particularly, per, perhaps, placed, please, plus, possible, presumably, probably, provides, que, quite, qv, rather, rd, re, really, reasonably, regarding, regardless, regards, relatively, respectively, right, said, same, saw, say, saying, says, second, secondly, see, seeing, seem, seemed, seeming, seems, seen, self, selves, sensible, sent, serious, seriously, seven, several, shall, she, should, shouldn’t, since, six, so, some, somebody, somehow, someone, something, sometime, sometimes, somewhat, somewhere, soon, sorry, specified, specify, specifying, still, sub, such, sup, sure, t’s, take, taken, tell, tends, th, than, thank, thanks, thanx, that, that’s, thats, the, their, theirs, them, themselves, then, thence, there, there’s, thereafter, thereby, therefore, therein, theres, thereupon, these, they, they’d, they’ll, they’re, they’ve, think, third, this, thorough, thoroughly, those, though, three, through, throughout, thru, thus, to, together, too, took, toward, towards, tried, tries, truly, try, trying, twice, two, un, under, unfortunately, unless, unlikely, until, unto, up, upon, us, use, used, useful, uses, using, usually, value, various, very, via, viz, vs, want, wants, was, wasn’t, way, we, we’d, we’ll, we’re, we’ve, welcome, well, went, were, weren’t, what, what’s, whatever, when, whence, whenever, where, where’s, whereafter, whereas, whereby, wherein, whereupon, wherever, whether, which, while, whither, who, who’s, whoever, whole, whom, whose, why, will, willing, wish, with, within, without, won’t, wonder, would, would, wouldn’t, yes, yet, you, you’d, you’ll, you’re, you’ve, your, yours, yourself, yourselves, zero, give".split(/\s?\,\s?/);
  encodeAlphabet: string = "123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
  encodeBase: number = this.encodeAlphabet.length;
  emailRegex: RegExp = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,12}$/i;

  isStopWord(word: string): boolean {
    return this.stopWords.indexOf(word.toLowerCase()) >= 0;
  }

  getStopWords(): string[] {
    return this.stopWords;
  }

  capitalize(value: string): string {
    const words = value.trim().split(/\s+/);
    const out: any[] = [];
    for (const word of words) {
      const w = word.charAt(0).toUpperCase() + word.slice(1);
      out.push(w);
    }
    return out.join(' ');
  }

  truncate(value: string, limit: number, omitEllipses?: boolean): string {
    if (value) {
      if (value.length < limit) {
        return value;
      } else {
        let result = value.substring(0, limit);
        if (!omitEllipses) {
          result += '...';
        }
        return result;
      }
    } else {
      return '';
    }
  }

  titleCase(original: string): string {
    const str: any = original.split(' ');

    for (let i = 0; i < str.length; i++) {
      str[i] = str[i].split('');
      str[i][0] = str[i][0].toUpperCase();
      str[i] = str[i].join('');
    }
    return str.join(' ');
  }

  moveItemInArray(array: any[], oldIndex: number, newIndex: number): any[] {
    if (newIndex >= array.length) {
      let k = newIndex - array.length;
      while ((k--) + 1) {
        array.push(undefined);
      }
    }
    array.splice(newIndex, 0, array.splice(oldIndex, 1)[0]);
    return array;
  }

  toMap(list: any[], keyAccessor: (item: any) => any): any {
    const result: any = {};
    if (list) {
      for (const item of list) {
        const key = keyAccessor(item);
        if (key) {
          result[key] = item;
        }
      }
    }
    return result;
  }

  encode(num: number): string {
    let encoded = '';
    while (num) {
      const r = num % this.encodeBase;
      num = Math.floor(num / this.encodeBase);
      encoded = this.encodeAlphabet[r].toString() + encoded;
    }
    return encoded;
  }

  encodeRangeForLength(length: number): number {
    return Math.pow(this.encodeBase, length);
  }

  decode(str: string): number {
    let decoded = 0;
    while (str) {
      const index = this.encodeAlphabet.indexOf(str[0]);
      const power = str.length - 1;
      decoded += index * (Math.pow(this.encodeBase, power));
      str = str.substring(1);
    }
    return decoded;
  }

  isValidEmail(email: string): boolean {
    if (email && this.emailRegex.test(email)) {
      return true;
    } else {
      return false;
    }
  }

  getDigits(value: number): number[] {
    const result: number[] = [];
    const s = value.toString();
    for (let i = 0; i < s.length; i++) {
      result.push(Number.parseInt(s.charAt(i)));
    }
    return result;
  }

  cleanName(name: string): string {
    const result = this.parseName(name);
    if (result) {
      return result[0] + ' ' + result[1];
    } else {
      return null;
    }
  }

  parseName(name: string): string[] {
    if (name) {
      const parts = name.trim().split(' ');
      if (parts.length > 1) {
        return [this.capitalize(parts[0]), this.capitalize(parts[parts.length - 1])];
      } else {
        return null;
      }
    } else {
      return null;
    }
  }

  stripUriScheme(url: string): string {
    if (!url) {
      return url;
    }
    const regex = /^([a-z]{2,8}\:(\/\/)?)(.*)$/i;
    const matches = regex.exec(url);
    if (matches) {
      return matches[3];
    } else {
      return url;
    }
  }

  sleep(delayMsecs: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      setTimeout(() => { resolve(); }, delayMsecs);
    });
  }

  async promiseWithTimeout<V>(promise: Promise<V>, timeout: number): Promise<RaceResult<V>> {
    let timedOut: boolean = false;
    const p = await Promise.race([promise, this.sleep(timeout).then(() => {
      timedOut = true;
    })]);
    let response: RaceResult<V>;
    if (timedOut) {
      response = { timedOut: true };
    } else {
      response = {
        timedOut: false,
        result: p as V
      };
    }
    return response;
  }

  hashCode(value: string): number {
    let hash = 0;
    let i;
    let chr;
    let len;
    if (value.length === 0) {
      return hash;
    }
    for (i = 0, len = value.length; i < len; i++) {
      chr = value.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0; // Convert to 32bit integer
    }
    return hash;
  }

  escapeHtml(unsafe: string, newLineBreaks: boolean): string {
    let result = unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
    if (newLineBreaks) {
      result = result.replace(/\n/g, '<br/>');
    }
    return result;
  }

  spliceString(srcString: string, start: number, delCount: number, newSubstr: string) {
    return srcString.slice(0, start) + newSubstr + srcString.slice(start + Math.abs(delCount));
  }

  logErrorObject(err: any, includeStack = true): string {
    const result: any = {
    };
    try {
      const s = JSON.stringify(err);
      result.asString = utils.truncate(s, 10000);
    } catch (e) {
      // noop
    }
    if (includeStack && err.stack) {
      result.stack = err.stack;
    }
    if (typeof err === 'object' && err.checked) {
      result.wrapped = err;
    }
    if (err.fileName) {
      result.fileName = err.fileName;
    }
    if (err.lineNumber) {
      result.lineNumber = err.lineNumber;
    }
    if (err.columnNumber) {
      result.columnNumber = err.columnNumber;
    }
    if (err.name) {
      result.name = err.name;
    }
    if (err.message) {
      result.message = err.message;
    }
    return result;
  }

  findIndexOfFirstDifference(s1: string, s2: string): number {
    if (!s1 || !s2) {
      return 0;
    }
    let index = 0;
    while (index < s1.length && index < s2.length && s1[index] === s2[index]) {
      index++;
    }
    return index;
  }

  nullOnError<T>(promise: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      void promise.then((t: T) => {
        resolve(t);
      }).catch((err) => {
        resolve(null);
      });
    });
  }

  stripLineWith(s: string, startingWith: string): string {
    if (!s || !startingWith) {
      return s;
    }
    const lines = s.split(/[\n\r]+/);
    const rlines: string[] = [];
    for (const line of lines) {
      if (!line.startsWith(startingWith)) {
        rlines.push(line);
      }
    }
    return rlines.join('\n');
  }
}

const utils = new Utils();

export { utils }
