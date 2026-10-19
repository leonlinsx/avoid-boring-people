"""Endpoint theory and 1/101-person chart invariants for four-family model."""
import numpy as np
import pytest

from analyses.luck_preparation import run as f


def test_design_and_loss_reversal():
    assert len(f.FAMILIES) == 4
    assert len(f.SCENARIOS) == 7
    assert f.ADD_HORIZONS == (1, 100, 10_000)
    assert f.MULT_HORIZONS == (1, 10, 100)
    assert f.PEOPLE == 101
    exact = f.FAMILIES[-1].mult_factors
    assert exact[0]*exact[3] == pytest.approx(1)
    assert exact[1]*exact[2] == pytest.approx(1)


def test_expected_wealth_is_arithmetic_not_geometric():
    s = f.SCENARIOS[0]
    for family in f.FAMILIES[:3]:
        assert f.expected_ending_wealth(family, s, max(family.horizons)) == pytest.approx(1)
    family = f.FAMILIES[-1]
    r, g = f.expected_mult(family.mult_factors, .5, .5)
    assert r == pytest.approx(.0028030303030303)
    assert g == pytest.approx(0, abs=1e-14)
    assert f.expected_ending_wealth(family, s, 100) == pytest.approx((1+r)**100)
    assert f.expected_ending_wealth(family, s, 100) > 1.3


def test_symmetric_additive_expected_wealth():
    family = f.FAMILIES[2]
    for s in f.SCENARIOS:
        result = f.expected_ending_wealth(family, s, 10_000)
        assert result == pytest.approx(1+10_000*f.expected_add(family.add_payoffs, s.p_prepare, s.p_good))
    assert f.expected_ending_wealth(family, f.SCENARIOS[5], 10_000) == pytest.approx(1)
    assert f.expected_ending_wealth(family, f.SCENARIOS[6], 10_000) == pytest.approx(1)


def test_preserve_historical_single_path_seed42():
    codes = f.simulate_codes_single(f.SCENARIOS[0], 100, 42)
    assert f.add_path(codes[:1], f.FAMILIES[0].add_payoffs)[-1] == 0
    assert f.mult_path(codes[:1], f.FAMILIES[1].mult_factors)[-1] == pytest.approx(.99)
    assert f.mult_path(codes[:100], f.FAMILIES[1].mult_factors)[-1] == pytest.approx(.9431, abs=.001)


def test_single_marker_not_line_all_28_cases():
    for family in f.FAMILIES:
        for s in f.SCENARIOS:
            n = max(family.horizons)
            codes = f.simulate_codes_single(s, n)
            path = (f.add_path(codes,family.add_payoffs) if family.kind=="add"
                    else f.mult_path(codes,family.mult_factors))
            fig = f.make_single_chart(family,s,path,n)
            assert len(fig.data) == 2
            assert list(fig.data[-1].x) == [n]
            assert fig.data[-1].mode == "markers"
            assert fig.data[-1].marker.color == "#9333ea"
            assert "Theoretical expected ending wealth" in fig.data[-1].name
            assert family.display_payoff in fig.layout.title.text
            if family.kind == "add":
                assert fig.layout.yaxis.type == "linear"


def test_cohort_mean_median_expected_all_28_cases():
    for family in f.FAMILIES:
        n = max(family.horizons)
        for s in f.SCENARIOS:
            codes = f.simulate_codes_cohort(s,n,people=101)
            people = (f.add_path(codes,family.add_payoffs) if family.kind=="add"
                      else f.mult_path(codes,family.mult_factors))
            fig = f.make_cohort_chart(family,s,people)
            assert len(fig.data) == 103
            assert "Median-ending person" in fig.data[-3].name
            assert "Observed mean ending wealth" in fig.data[-2].name
            assert "Theoretical expected ending wealth" in fig.data[-1].name
            assert fig.data[-1].mode == "markers"
            assert fig.data[-2].mode == "markers"
            assert fig.data[-1].marker.symbol == "circle"
            assert fig.data[-2].marker.symbol == "diamond"
            assert list(fig.data[-1].x) == [n]
            median_index = np.argsort(people[:,-1],kind="stable")[50]
            assert np.array_equal(fig.data[-3].y, people[median_index, np.asarray(fig.data[-3].x,dtype=int)])
            assert fig.data[-2].y[0] == pytest.approx(np.mean(people[:,-1]))


def test_offscale_expected_marker_labeled_and_axis_not_expanded():
    family, s = f.FAMILIES[0], f.SCENARIOS[1]
    path = f.add_path(f.simulate_codes_single(s,1), family.add_payoffs)
    fig = f.make_single_chart(family,s,path,1)
    assert "above scale" in fig.data[-1].name
    assert "Expected:" in fig.layout.annotations[-1].text
    assert fig.layout.yaxis.range[1] < f.expected_ending_wealth(family,s,1)


def test_contextual_log_axis():
    family = f.FAMILIES[1]
    assert f.axis_bounds(family, np.array([1,10,100]))[0]
    assert not f.axis_bounds(family, np.array([.98,1.05]))[0]
    assert not f.axis_bounds(f.FAMILIES[0], np.array([-10,100]))[0]


def test_table_expected_wealth_and_horizon_titles_are_explicit():
    for family in f.FAMILIES:
        scenario = f.SCENARIOS[0]
        final_horizon = max(family.horizons)
        codes = f.simulate_codes_single(scenario, final_horizon)
        cohort_codes = f.simulate_codes_cohort(scenario, final_horizon, people=101)
        if family.kind == "add":
            one = f.add_path(codes, family.add_payoffs)
            people = f.add_path(cohort_codes, family.add_payoffs)
        else:
            one = f.mult_path(codes, family.mult_factors)
            people = f.mult_path(cohort_codes, family.mult_factors)
        table_one = f.single_table(family, scenario, [one[:n+1] for n in family.horizons])
        table_many = f.cohort_table(family, scenario, people)
        assert "Theoretical expected end" in table_one
        assert "Theoretical expected end" in table_many
        assert f"{final_horizon:,} trials" in f.make_single_chart(
            family, scenario, one, final_horizon
        ).layout.title.text
        assert f"{final_horizon:,} trials" in f.make_cohort_chart(
            family, scenario, people
        ).layout.title.text


def test_one_script_creates_all_tables_no_blog_files(tmp_path):
    target = f.run_all(output_dir=tmp_path)
    assert target == tmp_path
    a = (tmp_path/"single_summary.md").read_text()
    b = (tmp_path/"cohort_summary.md").read_text()
    assert a.count("### ") == b.count("### ") == 28
    assert "Theoretical expected end" in a
    assert "Theoretical expected end" in b
    assert not list(tmp_path.glob("**/*.png"))
    assert not list(tmp_path.glob("**/*.html"))


def test_png_baseline_16_and_no_index_file(tmp_path):
    dated = tmp_path/"src/content/blog/2026_10_24_luck_preparation"
    dated.mkdir(parents=True)
    imgs = dated/"assets"
    f.run_all(output_dir=tmp_path/"results", png="baseline",
              article_assets=imgs)
    assert len(list(imgs.glob("*.png"))) == 16
    assert all(x.read_bytes()[:8] == b"\x89PNG\r\n\x1a\n"
               for x in imgs.glob("*.png"))
    assert not (dated/"index.md").exists()
    with pytest.raises(FileExistsError):
        f.run_all(output_dir=tmp_path/"results", png="baseline",
                  article_assets=imgs)


def test_do_not_autocreate_astro_article_folder(tmp_path):
    with pytest.raises(FileNotFoundError):
        f.run_all(output_dir=tmp_path/"results", png="baseline",
                  article_assets=tmp_path/"missing/assets")


def test_python_module_cli_help_and_table_output(tmp_path):
    """Exercise the actual -m entrypoint, not just imported run_all()."""
    import subprocess
    import sys

    command = [sys.executable, "-m", "analyses.luck_preparation.run"]
    help_result = subprocess.run(command + ["--help"], check=True,
                                 capture_output=True, text=True)
    assert "--html" in help_result.stdout
    assert "--png" in help_result.stdout

    result = subprocess.run(
        command + ["--people", "3", "--output-dir", str(tmp_path)],
        check=True, capture_output=True, text=True
    )
    assert str(tmp_path) in result.stdout
    for name in ("single_summary.md", "cohort_summary.md"):
        table = (tmp_path / name).read_text(encoding="utf-8")
        assert table.count("### ") == 28
        assert "Theoretical expected end" in table
