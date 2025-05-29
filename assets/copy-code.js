
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('pre > code').forEach((codeBlock) => {

        const copyButton = document.createElement('button');
        copyButton.className = 'copy-code-button'; 
        copyButton.textContent = '⧉';

        codeBlock.parentNode.insertBefore(copyButton, codeBlock);

        copyButton.addEventListener('click', () => {
            const codeToCopy = codeBlock.innerText;
            navigator.clipboard.writeText(codeToCopy)
                .then(() => {
                    copyButton.textContent = '✅';
                    setTimeout(() => {
                        copyButton.textContent = '⧉';
                    }, 2000); 
                })
                .catch(err => {
                    console.error('Failed to copy text: ', err);
                    copyButton.textContent = '❌';
                });
        });
    });
});
