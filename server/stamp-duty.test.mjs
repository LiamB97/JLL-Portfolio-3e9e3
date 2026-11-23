import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateStampDuty, parseStampDutyPrice} from '../src/stamp-duty.ts';

const estimate = (price, type = 'standard', nonResident = false) =>
  calculateStampDuty(parseStampDutyPrice(price), type, nonResident).pounds;

test('matches HMRC examples for standard, first-time and higher rates', () => {
  assert.equal(estimate('295,000'), 4750);
  assert.equal(estimate('500,000', 'first-time'), 10000);
  assert.equal(estimate('300,000', 'additional'), 20000);
  assert.equal(estimate('1,725,000'), 120750);
});

test('keeps the first-time relief cap inclusive and uses standard bands above it', () => {
  assert.equal(estimate('300,000', 'first-time'), 0);
  assert.deepEqual(calculateStampDuty(50_000_000, 'first-time', false), {pounds: 10000, firstTimeRelief: true});
  assert.deepEqual(calculateStampDuty(50_000_001, 'first-time', false), {pounds: 15000, firstTimeRelief: false});
  assert.equal(estimate('500,000.01', 'first-time', true), 25000);
});

test('applies the non-resident surcharge to the selected bands and respects the £40,000 threshold', () => {
  assert.equal(estimate('450,000'), 12500);
  assert.equal(estimate('450,000', 'first-time'), 7500);
  assert.equal(estimate('450,000', 'additional'), 35000);
  assert.equal(estimate('450,000', 'standard', true), 21500);
  assert.equal(estimate('450,000', 'first-time', true), 16500);
  assert.equal(estimate('450,000', 'additional', true), 44000);
  assert.equal(estimate('39,999.99', 'additional', true), 0);
  assert.equal(estimate('40,000', 'additional', true), 2800);
});

test('rounds down the final tax at the penny boundary', () => {
  assert.equal(estimate('250,019.99'), 2500);
  assert.equal(estimate('250,020'), 2501);
});

test('accepts prices in pounds and rejects blank, malformed and unsupported values', () => {
  assert.equal(parseStampDutyPrice('£ 450,000.50'), 45_000_050);
  assert.equal(parseStampDutyPrice('٤٥٠٬٠٠٠٫٥'), 45_000_050);
  assert.equal(parseStampDutyPrice('４５００００'), 45_000_000);
  for (const invalid of ['', '   ', '0', '-450000', '450e3', '12,34', '450000.001', '999999999999999999999999.99']) {
    assert.equal(parseStampDutyPrice(invalid), null, invalid);
  }
});
