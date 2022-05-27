import { expect } from "chai";
import { Wallet } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { ethers, waffle } from "hardhat";
import { SimpleVault, TestToken } from "../typechain";

describe("SimpleVault", () => {
  let deployer: Wallet;
  let signerA: Wallet;
  let signerB: Wallet;

  let token: TestToken;
  let vault: SimpleVault;

  beforeEach("Set up", async () => {
    const [_deployer, _signerA, _signerB] = waffle.provider.getWallets();

    deployer = _deployer;
    signerA = _signerA;
    signerB = _signerB;

    token = await (
      await ethers.getContractFactory("TestToken")
    ).deploy("DAI", "DAI");
    await token.deployed();
    vault = await (
      await ethers.getContractFactory("SimpleVault")
    ).deploy(token.address);
    await vault.deployed();

    for (const signer of [deployer, signerA, signerB]) {
      await token.connect(signer).faucet(parseEther("100"));
    }
  });

  it("should allow depositing", async function () {
    const toDeposit = parseEther("10");

    await token.connect(signerA).approve(vault.address, toDeposit);
    await vault.connect(signerA).deposit(toDeposit);

    expect(await vault.s_totalShares()).to.equal(1);
    expect(await vault.s_sharesOf(signerA.address)).to.equal(1);
    expect(await token.balanceOf(vault.address)).to.equal(toDeposit);
  });

  it("should allow withdrawing", async function () {
    const toDeposit = parseEther("10");
    const expectedShares = 1;

    await token.connect(signerA).approve(vault.address, toDeposit);
    await vault.connect(signerA).deposit(toDeposit);

    expect(await vault.s_totalShares()).to.equal(expectedShares);
    expect(await vault.s_sharesOf(signerA.address)).to.equal(expectedShares);
    expect(await token.balanceOf(vault.address)).to.equal(toDeposit);

    const toWithdraw = expectedShares;

    await vault.connect(signerA).withdraw(toWithdraw);

    expect(await vault.s_totalShares()).to.equal(expectedShares - toWithdraw);
    expect(await vault.s_sharesOf(signerA.address)).to.equal(
      expectedShares - toWithdraw
    );
    expect(await token.balanceOf(vault.address)).to.equal(0);
  });

  it("should allow correct withdrawals when multiple users are interacting", async function () {
    const toDepositA = parseEther("10");
    const toDepositB = parseEther("20");
    const expectedSharesA = 1;
    const expectedSharesB = 2;

    const iniBalanceA = await token.balanceOf(signerA.address);
    const iniBalanceB = await token.balanceOf(signerB.address);

    await token.connect(signerA).approve(vault.address, toDepositA);
    await vault.connect(signerA).deposit(toDepositA);
    await token.connect(signerB).approve(vault.address, toDepositB);
    await vault.connect(signerB).deposit(toDepositB);

    expect(await vault.s_sharesOf(signerA.address)).to.equal(expectedSharesA);
    expect(await vault.s_sharesOf(signerB.address)).to.equal(expectedSharesB);
    expect(await vault.s_totalShares()).to.equal(
      expectedSharesA + expectedSharesB
    );
    expect(await token.balanceOf(vault.address)).to.equal(
      toDepositA.add(toDepositB)
    );

    const toWithdrawA = expectedSharesA;
    const toWithdrawB = expectedSharesB;

    await vault.connect(signerA).withdraw(toWithdrawA);
    await vault.connect(signerB).withdraw(toWithdrawB);

    expect(await vault.s_totalShares()).to.equal(
      expectedSharesA - toWithdrawA + (expectedSharesB - toWithdrawB)
    );
    expect(await vault.s_sharesOf(signerA.address)).to.equal(
      expectedSharesA - toWithdrawA
    );
    expect(await vault.s_sharesOf(signerB.address)).to.equal(
      expectedSharesB - toWithdrawB
    );
    expect(await token.balanceOf(vault.address)).to.equal(0);

    expect(await token.balanceOf(signerA.address)).to.equal(iniBalanceA);
    expect(await token.balanceOf(signerB.address)).to.equal(iniBalanceB);
  });

  it("should calculate proportional withdrawals when balance changes", async function () {
    const toDepositA = parseEther("10");
    const toDepositB = parseEther("20");
    const expectedSharesA = 1;
    const expectedSharesB = 2;

    const iniBalanceA = await token.balanceOf(signerA.address);
    const iniBalanceB = await token.balanceOf(signerB.address);

    await token.connect(signerA).approve(vault.address, toDepositA);
    await vault.connect(signerA).deposit(toDepositA);
    await token.connect(signerB).approve(vault.address, toDepositB);
    await vault.connect(signerB).deposit(toDepositB);

    expect(await vault.s_sharesOf(signerA.address)).to.equal(expectedSharesA);
    expect(await vault.s_sharesOf(signerB.address)).to.equal(expectedSharesB);
    expect(await vault.s_totalShares()).to.equal(
      expectedSharesA + expectedSharesB
    );
    expect(await token.balanceOf(vault.address)).to.equal(
      toDepositA.add(toDepositB)
    );

    // SIMULATING BALANCE CHANGING
    await token.connect(deployer).transfer(vault.address, parseEther("30"));
    // Now the vault should have double the amount of tokens

    const toWithdrawA = expectedSharesA;
    const toWithdrawB = expectedSharesB;

    await vault.connect(signerA).withdraw(toWithdrawA);
    await vault.connect(signerB).withdraw(toWithdrawB);

    expect(await vault.s_totalShares()).to.equal(
      expectedSharesA - toWithdrawA + (expectedSharesB - toWithdrawB)
    );
    expect(await vault.s_sharesOf(signerA.address)).to.equal(
      expectedSharesA - toWithdrawA
    );
    expect(await vault.s_sharesOf(signerB.address)).to.equal(
      expectedSharesB - toWithdrawB
    );
    expect(await token.balanceOf(vault.address)).to.equal(0);

    // Adding the additional rewards. In this case, since the vault balance doubled,
    // the withdrawn amount should be doubled as well
    expect(await token.balanceOf(signerA.address)).to.equal(
      iniBalanceA.add(toDepositA)
    );
    expect(await token.balanceOf(signerB.address)).to.equal(
      iniBalanceB.add(toDepositB)
    );
  });
});
