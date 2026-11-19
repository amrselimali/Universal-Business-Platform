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
            if (!_variables.TryGetValue(name, out var value))
                throw new KeyNotFoundException($"Payroll formula variable '{name}' was not provided.");
            return value;
        }

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

        private void Require(char value)
        {
            if (!TryConsume(value)) throw new FormatException($"Expected '{value}' at position {_position}.");
        }
    }
}
