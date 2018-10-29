import { format_number } from '../pipes';

export class Question {
  text: string;
  query: string | string[];
  parameters: object = {};
  defaults: object | null = {};
  headers: string[];
  formatters: any[] = [];
  originalHeaders: string[] | null;
}

export class PreparedQuestionTextFragment {
  isText: boolean = false;
  isParameter: boolean = false;
  value: string = '';
}

export class PreparedQuestionParameterFragment {
  isText: boolean = false;
  isParameter: boolean = false;
  name: string = '';
  value: string = '';
  values: object = {};
}

export type PreparedQuestionFragment = PreparedQuestionTextFragment | PreparedQuestionParameterFragment;
export type PreparedQuestionFragments = PreparedQuestionFragment[];

export class PreparedQuestion extends Question {
  parsed: PreparedQuestionFragments = [];
  defaults: object = {};  // key-value pairs of default values for each parameter
}

export type Questions = Question[];
export type PreparedQuestions = PreparedQuestion[];

export class DescriptorBase {
  visualizationTemplates: any;
  pathPrefix: string;
  style: string;
  questions: Questions;

  private SIMPLE_MODIFIER = /:([a-z_]+)$/;
  private PARAMETER_MODIFIER = /:([a-z_]+\([a-z_]+\))$/;

  private getFormatter(mod: string, themeId: string) {
    // Simple modifiers first
    if (mod === 'number') {
      return (x: any, row: any) => {
        x = parseFloat(x);

        return isFinite(x)
          ? format_number(x)
          : '-';
      };
    } else if (mod === 'budget_code') {
      return (x: any, row: any) => {
        if (!x) {
          return '';
        }
        x = x.slice(2);
        let code = '';
        while (x.length > 0) {
          code += '.' + x.slice(0, 2);
          x = x.slice(2);
        }
        return code.slice(1);
      };
    } else if (mod === 'yesno') {
      return (x: any, row: any) => {
        return x ? 'כן' : 'לא';
      };
    } else { // Parametrized modifiers next
      let parts = mod.split('(');
      mod = parts[0];
      let param = parts[1].slice(0, parts[1].length - 1);
      if (mod === 'item_link') {
        return (x: any, row: any) => {
          let item_id = row[param];
          if (item_id) {
            if (themeId) {
              return '<a href="/i/' + row[param] + '?theme=' + themeId + '">' + x + '</a>';
            } else {
              return '<a href="/i/' + row[param] + '">' + x + '</a>';
            }
          } else {
            return x;
          }
        };
      } else if (mod === 'search_term') {
        return (x: any, row: any) => {
          let term = row[param];
          if (term) {
            // if (themeId) {
            //   return '<a href="/s/?q=' + encodeURIComponent(term) + '&theme=' + themeId + '">' + x + '</a>';
            // } else {
            return '<a href="/s/?q=' + encodeURIComponent(term) + '" title="חיפוש התקנה ' + x + ' במפתח התקציב">' + x + '</a>';
            // }
          } else {
            return x;
          }
        };
      } else {
        throw('Unknown formatter ' + mod);
      }
    }
  }

  private getRowGetter(header: string) {
    return (x: any, row: any) => {
      return row[header];
    };
  }

  private compose(func: any, func2: any) {
    return (x: any, row: any) => func2(func(x, row), row);
  }

  private processHeadersFormatters(question: Question, themeId: string): any {
    if (question.originalHeaders) {
      // Don't process the same question twice
      return;
    }
    question.originalHeaders = question.headers;

    let _headers = [];
    let _formatters = [];

    for (let header of question .headers) {
      let _funcs: any[] = [];
      while (header.length > 0) {
        let found = false;
        for (let modifier of [this.SIMPLE_MODIFIER, this.PARAMETER_MODIFIER]) {
          if (modifier.test(header)) {
            let idx = header.search(modifier);
            let mod = header.slice(idx + 1);
            header = header.slice(0, idx);
            _funcs.push(this.getFormatter(mod, themeId));
            found = true;
            break;
          }
        }
        if (found) {
          continue;
        }

        _funcs.push(this.getRowGetter(header));
        let func: any = null;
        while (_funcs.length > 0) {
          if (func === null ) {
            func = _funcs.pop();
          } else {
            let func2 = _funcs.pop();
            func = this.compose(func, func2);
          }
        }

        _headers.push(header);
        _formatters.push((row: any) => func('', row));
        break;
      }
    }
    question.headers = _headers;
    question.formatters = _formatters;
  }

  constructor(pathPrefix: string,
    style: string,
    questions: Questions,
    visualizationTemplates?: any) {
      this.pathPrefix = pathPrefix;
      this.style = style;
      this.questions = questions;
      this.visualizationTemplates = visualizationTemplates || {};
    }

    public init(themeId: string) {
      for (let question of this.questions) {
        this.processHeadersFormatters(question, themeId);
      }
  }

}

export class SimpleDescriptor extends DescriptorBase {
  preTitleTemplate: string = '';
  titleTemplate: string = '';
  subtitleTemplate: string = '';
  textTemplate: string = '';
  amountTemplate: string = '';

  constructor(x: any, style?: string) {
    super(x.pathPrefix, style || 'simple', x.questions, x.visualizationTemplates);
    this.preTitleTemplate = x.preTitleTemplate;
    this.titleTemplate = x.titleTemplate;
    this.subtitleTemplate = x.subtitleTemplate;
    this.textTemplate = x.textTemplate;
    this.amountTemplate = x.amountTemplate;
  }
}

export class Indicator {
  asset: string;
  template: string;

  constructor(asset: string, template: string) {
    this.asset = asset;
    this.template = template;
  }
}

export class ReportDescriptor extends DescriptorBase {
  indicators: Indicator[] = [];
  titlePrefix: string = '';
  titleSuffix: string = '';
  titleField: string = '';
  titleOtherURLPrefix: string = '';
  suffixTemplate: string = '';

  constructor(x: any) {
    super(x.pathPrefix, 'report', x.questions);
    this.indicators = x.indicators;
    this.suffixTemplate = x.suffixTemplate;
    this.titlePrefix = x.titlePrefix;
    this.titleSuffix = x.titleSuffix;
    this.titleField = x.titleField;
    this.titleOtherURLPrefix = x.titleOtherURLPrefix;
  }
}

export class ProcureDescriptor extends DescriptorBase {
  constructor(x: any) {
    super(x.pathPrefix, 'procure', x.questions);
  }
}

export class PeopleDescriptor extends DescriptorBase {
  constructor(x: any) {
    super(x.pathPrefix, 'people', x.questions);
  }
}
