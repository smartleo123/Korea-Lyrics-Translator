"""Offline evaluation contract tests; never call live models."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location("alignment_runner",ROOT/"runner.py")
runner=importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class AlignmentTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dataset,cls.checksum=runner.load_dataset(ROOT/"dataset.json")

    def test_dataset_and_hash(self):
        self.assertEqual(len(self.dataset["cases"]),8)
        self.assertEqual(len(self.checksum),64)

    def test_perfect_score_and_optional_edges(self):
        case=self.dataset["cases"][3]
        gold=runner.edges(case["sure"],case)
        metrics=runner.score(case,gold)
        self.assertEqual((metrics["precision"],metrics["recall"],metrics["f1"],metrics["aer"]),(1,1,1,0))
        optional=runner.score(case,gold | {(1,2)})
        self.assertEqual(optional["precision"],1)
        self.assertEqual(optional["aer"],0)

    def test_invalid_out_of_range_and_wrong_types(self):
        case=self.dataset["cases"][0]
        for bad in ([[10,0]],[[True,0]],[["0",0]],[{"source":0,"target":9}]):
            with self.subTest(bad=bad):
                with self.assertRaises(ValueError):
                    runner.edges(bad,case)

    def test_duplicate_gold_rejected(self):
        data=json.loads((ROOT/"dataset.json").read_text(encoding="utf-8"))
        data["cases"][0]["sure"].append(data["cases"][0]["sure"][0])
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/"dataset.json"
            path.write_text(json.dumps(data),encoding="utf-8")
            with self.assertRaisesRegex(ValueError,"Duplicate edge"):
                runner.load_dataset(path)

    def test_failed_case_is_not_excluded(self):
        case=self.dataset["cases"][0]
        good={"status":"ok","seconds":0,"metrics":runner.score(case,runner.edges(case["sure"],case))}
        bad={"status":"failed","seconds":0,"metrics":runner.score(case,set())}
        summary=runner.summary([good,bad])
        self.assertEqual(summary["failed"],1)
        self.assertAlmostEqual(summary["recall"],.5)
        self.assertLess(summary["micro_f1"],1)

    def test_mock_adapter_contract_not_fake_quality(self):
        case=self.dataset["cases"][0]
        with patch.object(runner,"dispatch",return_value=[{"source":0,"target":0}]):
            result=runner.run({"cases":[case]},"gemini","dummy","bert",delay=0)
        self.assertEqual(result["summary"]["succeeded"],1)
        self.assertEqual(result["cases"][0]["edges"],[[0,0]])
        self.assertLess(result["summary"]["micro_f1"],1)

    def test_gemini_requires_secret_before_network(self):
        with patch.dict("os.environ",{"GEMINI_API_KEY":""}):
            with self.assertRaisesRegex(RuntimeError,"GEMINI_API_KEY"):
                runner.gemini(self.dataset["cases"][0],"gemini-2.5-flash",1)


if __name__=="__main__":
    unittest.main()
