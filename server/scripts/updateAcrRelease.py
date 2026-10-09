"""Install an approved Practice ACR PDF and move the teaching examples onto it.

Usage: python server/scripts/updateAcrRelease.py /absolute/path/ACR_practice_v3.6.1.pdf
Requires pypdf. The approved blank's bytes are copied unchanged. Example values,
filled appearances, write-across visibility and margin notes are preserved; the
new template supplies field behaviour, flags, page content and document scripts.
"""
from pathlib import Path
from io import BytesIO
import re
import shutil
import sys

from pypdf import PdfReader, PdfWriter
from pypdf.generic import ArrayObject, DictionaryObject, NameObject, NumberObject, TextStringObject

ROOT = Path(__file__).resolve().parents[2]
ACR = ROOT / 'server/acr-review'


def widgets(reader):
    result = {}
    for page_index, page in enumerate(reader.pages):
        for ref in page.get('/Annots', []):
            widget = ref.get_object()
            if widget.get('/Subtype') != '/Widget':
                continue
            owner = widget
            while '/T' not in owner and '/Parent' in owner:
                owner = owner['/Parent'].get_object()
            name = str(owner.get('/T', ''))
            result.setdefault(name, []).append((page_index, widget))
    return result


def migrate_example(source, template):
    old = PdfReader(source)
    writer = PdfWriter(clone_from=template)
    fields = writer.get_fields()
    originals = old.get_fields()
    old_widgets, new_widgets = widgets(old), widgets(writer)
    for name, original in originals.items():
        if name == 'Treatment Total Pages':
            continue  # v3.6.1 has two fixed treatment sheets; keep its corrected count and appearance.
        if name not in fields:
            if name in ('Tool Lock', 'Tool Unlock'):
                continue  # Retired buttons, not chart content.
            if name != 'Scenario Link':
                raise ValueError(f'Unmapped field in {source.name}: {name}')
            link = DictionaryObject({
                NameObject('/FT'): NameObject('/Tx'), NameObject('/T'): TextStringObject(name),
                NameObject('/V'): original['/V'].clone(writer), NameObject('/Ff'): NumberObject(1),
                NameObject('/Type'): NameObject('/Annot'), NameObject('/Subtype'): NameObject('/Widget'),
                NameObject('/Rect'): ArrayObject([NumberObject(n) for n in (0, 0, 1, 1)]),
                NameObject('/F'): NumberObject(2), NameObject('/P'): writer.pages[0].indirect_reference,
            })
            ref = writer._add_object(link)
            writer.root_object['/AcroForm']['/Fields'].append(ref)
            writer.pages[0]['/Annots'].append(ref)
            continue
        # get_fields returns a view of a field. Write through to its canonical PDF object.
        target = fields[name].indirect_reference.get_object()
        if '/V' in original:
            target[NameObject('/V')] = original['/V'].clone(writer)
        populated = str(original.get('/V', '')) not in ('', '/Off')
        assert len(old_widgets.get(name, [])) == len(new_widgets.get(name, [])), name
        for (old_page, ow), (new_page, nw) in zip(old_widgets.get(name, []), new_widgets.get(name, [])):
            if populated:
                assert old_page == new_page and all(abs(float(a) - float(b)) < 0.001
                    for a, b in zip(ow['/Rect'], nw['/Rect'])), (name, 'geometry changed')
            if populated and '/AP' in ow:
                nw[NameObject('/AP')] = ow['/AP'].clone(writer)
            if '/AS' in ow:
                nw[NameObject('/AS')] = ow['/AS'].clone(writer)
            if '/V' in ow and '/V' in original:
                nw[NameObject('/V')] = original['/V'].clone(writer)
            if name.startswith('Treatment Row ') and '/F' in ow:
                nw[NameObject('/F')] = ow['/F'].clone(writer)
    # Preserve the teaching notes without copying their old page/field graph.
    for page_index, page in enumerate(old.pages):
        notes = [(ref, ref.get_object()) for ref in page.get('/Annots', [])
                 if ref.get_object().get('/Subtype') != '/Widget']
        copied = {}
        for ref, note in notes:
            clone = DictionaryObject({NameObject(k): v.clone(writer) for k, v in note.items()
                                      if k not in ('/P', '/Parent', '/Popup')})
            clone[NameObject('/P')] = writer.pages[page_index].indirect_reference
            new_ref = writer._add_object(clone)
            writer.pages[page_index]['/Annots'].append(new_ref)
            copied[ref.idnum] = new_ref
        for ref, note in notes:
            for key in ('/Parent', '/Popup'):
                if key in note and note.raw_get(key).idnum in copied:
                    copied[ref.idnum].get_object()[NameObject(key)] = copied[note.raw_get(key).idnum]
    output = BytesIO()
    writer.write(output)
    updated = PdfReader(BytesIO(output.getvalue())).get_fields()
    for name, value in originals.items():
        if name in ('Tool Lock', 'Tool Unlock', 'Treatment Total Pages'):
            continue
        assert str(updated[name].get('/V', '')) == str(value.get('/V', '')), (source, name)
    temporary = source.with_suffix('.pdf.tmp')
    temporary.write_bytes(output.getvalue())
    temporary.replace(source)


def main():
    approved = Path(sys.argv[1]).resolve()
    template = PdfReader(approved)
    version = re.search(r'v(\d+(?:\.\d+)+)', template.metadata.title or '').group(1)
    assert len(template.pages) == 8 and len(template.get_fields()) == 1287
    legacy = ACR / 'test/fixtures/legacy-chest-pain-v3.4.pdf'
    if not legacy.exists():
        shutil.copyfile(ACR / 'test/ACR_model_chest_pain.pdf', legacy)
    for sample in sorted((ACR / 'test').glob('*.pdf')):
        migrate_example(sample, approved)
        public = ROOT / 'client/public/acr' / sample.name
        if public.exists():
            shutil.copyfile(sample, public)
    copies = [ACR / 'assets/ACR_practice_v3.pdf',
              ROOT / f'client/public/acr/ACR_practice_v{version}.pdf',
              *sorted((ROOT / 'client/public/acr').glob('ACR_practice_v*.pdf'))]
    for target in set(copies):
        shutil.copyfile(approved, target)
    scripts = template.trailer['/Root']['/Names']['/JavaScript']['/Names']
    assert len(scripts) == 2, 'Review script extraction if the document adds more scripts'
    script = scripts[1].get_object()['/JS']
    script = script.get_data().decode('utf-8') if hasattr(script, 'get_data') else str(script)
    (ACR / 'vendor/acrChecker.js').write_text(script, encoding='utf-8')
    print(f'Installed v{version}; preserved chart entries and notes, with the corrected treatment-page count.')


if __name__ == '__main__':
    main()
