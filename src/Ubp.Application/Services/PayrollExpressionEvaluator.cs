using System.Globalization;

namespace Ubp.Application.Services;

/// <summary>مقيّم حسابي محدود لا ينفذ C# أو SQL أو Reflection من مدخل المستخدم.</summary>
public sealed class PayrollExpressionEvaluator
{
    public decimal Evaluate(string expression, IReadOnlyDictionary<string, decimal> variables)
    {
        if (string.IsNullOrWhiteSpace(expression))
            throw new ArgumentException("Formula expression is required.", nameof(expression));
        var parser = new Parser(expression, variables);
        var value = parser.ParseExpression();
        parser.SkipWhiteSpace();
        if (!parser.End)
            throw new FormatException($"Unexpected token at position {parser.Position}.");
        return value;
    }

    private sealed class Parser
    {
        private readonly string _text;
        private readonly IReadOnlyDictionary<string, decimal> _variables;
        private int _position;

        public Parser(string text, IReadOnlyDictionary<string, decimal> variables)
        {
            _text = text;
            _variables = variables;
        }

        public int Position => _position;
        public bool End => _position >= _text.Length;

        public decimal ParseExpression()
        {
            var value = ParseComparison();
            while (true)
            {
                SkipWhiteSpace();
                if (TryConsume('&'))
                {
                    Require('&');
                    value = value != 0m && ParseComparison() != 0m ? 1m : 0m;
                }
                else if (TryConsume('|'))
                {
                    Require('|');
                    value = value != 0m || ParseComparison() != 0m ? 1m : 0m;
                }
                else return value;
            }
        }

        private decimal ParseComparison()
        {
            var left = ParseAdditive();
            while (true)
            {
                SkipWhiteSpace();
                if (TryConsume(">=")) left = left >= ParseAdditive() ? 1m : 0m;
                else if (TryConsume("<=")) left = left <= ParseAdditive() ? 1m : 0m;
                else if (TryConsume("<>")) left = left != ParseAdditive() ? 1m : 0m;
                else if (TryConsume("!=")) left = left != ParseAdditive() ? 1m : 0m;
                else if (TryConsume("==")) left = left == ParseAdditive() ? 1m : 0m;
                else if (TryConsume('=')) left = left == ParseAdditive() ? 1m : 0m;
                else if (TryConsume('>')) left = left > ParseAdditive() ? 1m : 0m;
                else if (TryConsume('<')) left = left < ParseAdditive() ? 1m : 0m;
                else return left;
            }
        }

        private decimal ParseAdditive()
        {
            var value = ParseTerm();
            while (true)
            {
                SkipWhiteSpace();
                if (TryConsume('+')) value += ParseTerm();
                else if (TryConsume('-')) value -= ParseTerm();
                else return value;
            }
        }

        private decimal ParseTerm()
        {
            var value = ParseFactor();
            while (true)
            {
                SkipWhiteSpace();
                if (TryConsume('*')) value *= ParseFactor();
                else if (TryConsume('/'))
                {
                    var divisor = ParseFactor();
                    if (divisor == 0) throw new DivideByZeroException("Payroll formula divisor cannot be zero.");
                    value /= divisor;
                }
                else return value;
            }
        }

        private decimal ParseFactor()
        {
            SkipWhiteSpace();
            if (TryConsume('+')) return ParseFactor();
            if (TryConsume('-')) return -ParseFactor();
            if (TryConsume('('))
            {
                var groupedValue = ParseExpression();
                Require(')');
                return groupedValue;
            }
            if (!End && (char.IsDigit(_text[_position]) || _text[_position] == '.'))
                return ParseNumber();
            var name = ParseIdentifier();
            if (name.Length == 0)
                throw new FormatException($"Expected number or variable at position {_position}.");
            SkipWhiteSpace();
            if (!End && _text[_position] == '(')
                return ParseFunction(name);
            if (!_variables.TryGetValue(name, out var value))
                throw new KeyNotFoundException($"Payroll formula variable '{name}' was not provided.");
            return value;
        }

        /// <summary>دوال معتمدة فقط (لا تنفيذ كود): IF/ROUND/CEILING/FLOOR/ABS/MIN/MAX/COALESCE/NULLIF/AND/OR/NOT.</summary>
        private decimal ParseFunction(string name)
        {
            Require('(');
            var args = new List<decimal>();
            SkipWhiteSpace();
            if (!TryConsume(')'))
            {
                do { args.Add(ParseExpression()); } while (TryConsume(','));
                Require(')');
            }
            return ApplyFunction(name, args);
        }

        private static decimal ApplyFunction(string name, List<decimal> args) =>
            name.ToUpperInvariant() switch
            {
                "IF" => args.Count < 3
                    ? throw new FormatException("IF requires three arguments.")
                    : args[0] != 0m ? args[1] : args[2],
                "ROUND" => args.Count switch
                {
                    0 => 0m,
                    1 => Math.Round(args[0], 0, MidpointRounding.AwayFromZero),
                    _ => Math.Round(args[0], (int)Math.Clamp(args[1], 0m, 8m), MidpointRounding.AwayFromZero)
                },
                "CEILING" => args.Count == 0 ? 0m : decimal.Ceiling(args[0]),
                "FLOOR" => args.Count == 0 ? 0m : decimal.Floor(args[0]),
                "ABS" => args.Count == 0 ? 0m : Math.Abs(args[0]),
                "MIN" => args.Count == 0 ? 0m : args.Min(),
                "MAX" => args.Count == 0 ? 0m : args.Max(),
                "COALESCE" => args.Count == 0 ? 0m : args.FirstOrDefault(x => x != 0m),
                "NULLIF" => args.Count < 2 || args[0] == args[1] ? 0m : args[0],
                "AND" => args.Count > 0 && args.All(x => x != 0m) ? 1m : 0m,
                "OR" => args.Any(x => x != 0m) ? 1m : 0m,
                "NOT" => args.Count > 0 && args[0] == 0m ? 1m : 0m,
                _ => throw new FormatException($"Unsupported payroll function '{name}'.")
            };

        private decimal ParseNumber()
        {
            var start = _position;
            while (!End && (char.IsDigit(_text[_position]) || _text[_position] == '.')) _position++;
            var token = _text[start.._position];
            if (!decimal.TryParse(token, NumberStyles.Number, CultureInfo.InvariantCulture, out var value))
                throw new FormatException($"Invalid number '{token}'.");
            return value;
        }

        private string ParseIdentifier()
        {
            SkipWhiteSpace();
            var start = _position;
            if (End || !(char.IsLetter(_text[_position]) || _text[_position] == '_')) return "";
            _position++;
            while (!End && (char.IsLetterOrDigit(_text[_position]) || _text[_position] == '_')) _position++;
            return _text[start.._position];
        }

        public void SkipWhiteSpace()
        {
            while (!End && char.IsWhiteSpace(_text[_position])) _position++;
        }

        private bool TryConsume(char value)
        {
            SkipWhiteSpace();
            if (!End && _text[_position] == value) { _position++; return true; }
            return false;
        }

        private bool TryConsume(string value)
        {
            SkipWhiteSpace();
            if (_position + value.Length > _text.Length) return false;
            if (!_text.AsSpan(_position, value.Length).SequenceEqual(value)) return false;
            _position += value.Length;
            return true;
        }

        private void Require(char value)
        {
            if (!TryConsume(value)) throw new FormatException($"Expected '{value}' at position {_position}.");
        }
    }
}
