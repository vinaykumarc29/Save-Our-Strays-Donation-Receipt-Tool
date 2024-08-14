import React, { useState } from "react";
import styles from "./MultiEmailInput.module.scss";
// import { toast } from "react-toastify";

type MultiEmailInputProps = {
  ccEmails: string[];
  onEmailsChange: (emails: string[]) => void;
};

const MultiEmailInput: React.FC<MultiEmailInputProps> = ({ ccEmails, onEmailsChange }) => {
  const [inputValue, setInputValue] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    setErrorMessage("");
    if (event.key === "Enter" || event.key === "Tab" && inputValue) {
      if (validateEmail(inputValue)) {
        onEmailsChange([...ccEmails, inputValue]);
        setInputValue("");
      } else {
        setErrorMessage("CC Email is not valid")
      }
    } else if (event.key === "Backspace" && !inputValue && ccEmails.length) {
      const newEmails = ccEmails.slice(0, -1);
      onEmailsChange(newEmails);
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };

  const removeEmail = (index: number) => {
    const newEmails = ccEmails.filter((_, i) => i !== index);
    onEmailsChange(newEmails);
  };

  const validateEmail = (email: string) => {
    return /^\S+@\S+\.\S+$/.test(email);
  };
  const handleBlur = () => {
    setErrorMessage("");
    if (inputValue) {
      if (validateEmail(inputValue)) {
        onEmailsChange([...ccEmails, inputValue]);
        setInputValue("");
      } else {
        setErrorMessage("CC Email is not valid")
      }
    }
  };

  return (
    <div className={styles.multiEmailInputContainer}>
      <div className={styles.emailsContainer}>
        {ccEmails.map((email, index) => (
          <div key={index} className={styles.emailTag}>
            {email}
            <button type="button" onClick={() => removeEmail(index)}>
              &times;
            </button>
          </div>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder="Add CC email"
        />
      </div>
      {errorMessage && <p className={styles.errorMessage}>{errorMessage}</p>}
    </div>
  );
};

export default MultiEmailInput;
