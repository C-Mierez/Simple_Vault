// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

import "@openzeppelin/contracts/interfaces/IERC20.sol";

contract SimpleVault {
    /// @notice The address of the ERC20 that the vault uses
    /// @dev Keeping it immutable for safety of the assets
    IERC20 public immutable i_token;

    /// @notice Counts the total shares
    uint256 public s_totalShares;

    /// @dev The total amount staked in the contract can be obtained from the token's balance
    /// so there is not need to keep track of it here

    /// @notice Keeps track of the each user's shares
    /// User -> Shares amount
    mapping(address => uint256) public s_sharesOf;

    constructor(IERC20 _token) {
        i_token = _token;
    }

    /// @dev Mints shares of the total balance
    function _mint(address _to, uint256 _amount) private {
        s_totalShares += _amount;
        s_sharesOf[_to] += _amount;
    }

    /// @dev Burns shares of the total balance
    function _burn(address _from, uint256 _amount) private {
        s_totalShares -= _amount;
        s_sharesOf[_from] -= _amount;
    }

    /// @dev Utility method for better readability
    function _totalBalance() private view returns (uint256) {
        return i_token.balanceOf(address(this));
    }

    /* ---------------------------- Public Functions ---------------------------- */
    function deposit(uint256 _amount) external {
        uint256 toMintShares;

        if (s_totalShares == 0) {
            toMintShares = 1;
        } else {
            toMintShares = (s_totalShares * _amount) / _totalBalance();
        }

        _mint(msg.sender, toMintShares);

        i_token.transferFrom(msg.sender, address(this), _amount);

        emit Deposited(_amount);
    }

    function withdraw(uint256 _shares) external {
        if (s_sharesOf[msg.sender] < _shares)
            revert InsufficientShares(s_sharesOf[msg.sender], _shares);

        uint256 toTransferAmount;

        toTransferAmount = (_totalBalance() * _shares) / s_totalShares;

        _burn(msg.sender, _shares);

        i_token.transfer(msg.sender, toTransferAmount);
    }

    /* --------------------------------- Events --------------------------------- */
    event Deposited(uint256 amount);
    event Withdrawn(uint256 amount);

    /* --------------------------------- Errors --------------------------------- */
    error InsufficientShares(uint256 currentShares, uint256 requestedShares);
}
