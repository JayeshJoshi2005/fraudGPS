# Report fonts

`DejaVuSans.ttf` and `DejaVuSans-Bold.ttf` are unmodified regular and bold DejaVu
Sans fonts, copied from the locally installed DejaVu distribution. They are bundled
so report rendering does not depend on Windows fonts or network access.

The upstream [DejaVu project](https://dejavu-fonts.github.io/) and
[license](https://dejavu-fonts.github.io/License.html) describe redistribution terms.
The full upstream license is retained in `LICENSE.txt`. ReportLab embeds subsets;
the test suite checks the rupee glyph and parses the generated reports.
